const chalk = require('chalk');
const debounce = require('lodash/debounce')
const awaitAll = require('../utils/awaitAll');

let restartTasks, startOver;

class Task {
  constructor({name, run, watch}) {
    if (!(typeof name === 'string' && name.length > 0)) throw new Error(`Invalid argument 'name': ${name}`);
    if (!(typeof run === 'function')) throw new Error(`Invalid argument 'run': ${run}`);
    if (!(!watch || (typeof watch === 'function' && watch.length === 1))) throw new Error(`Invalid argument 'watch': ${watch}`);
    this.parent = null;
    this.name = name;
    this.run = run;
    this.lastRun = null;
    this.working = false;
    this.updateTime = null;
    this.watch = watch;
  }

  _watch() {
    this.watch && this.watch(debounce(() => {
      const t = Date.now();
      let level = this;
      while (level) {
        level.updateTime = t;
        level = level.parent;
      }
      startOver();
    }, 250, {maxWait: 30 * 1000}));
  }

  _run() {
    if (this.working) return;
    this.working = true;
    const startTime = Date.now();
    console.info(`${this.name}: ${chalk.blue(`started`)}`);
    const prevUpdateTime = this.updateTime;
    let res;
    try {
      res = this.run();
    } catch (err) {
      console.error(err);
    }
    res.then(() => {
      console.info(`${this.name}: ${chalk.green(`completed in ${Math.round((Date.now() - startTime) / 10) / 100} sec`)}`);
      if (!restartTasks && prevUpdateTime === this.updateTime) this.lastRun = Date.now(); // there was NO a watch event while task was running
    }, (err) => {
      console.info(`${this.name}: ${chalk.red(`failed:`)} ${err.message}`);
    }).finally(() => {
      this.working = false;
    });
    return res;
  }
}

function runTasks({watch, tasks}) {

  if (!('_run' in tasks)) throw new Error(`Invalid argument 'tasks': ${tasks}`);

  if (watch) tasks._watch();

  const blockProcessTimer = setTimeout(() => {
  }, 0x7FFFFFFF);

  startOver = function () {
    if (tasks.working) {
      restartTasks = true;
      return;
    }
    restartTasks = false;
    return tasks._run()
      .catch((err) => {
        // console.error(err);
      })
      .then(() => {
        if (restartTasks) startOver();
      });
  };

  startOver()
    .finally(function () {
      !watch && clearTimeout(blockProcessTimer);
    });

}

function parallel(tasks) {
  tasks = tasks.filter(v => typeof v === 'object' && v !== null && '_run' in v);
  const task = {
    lastRun: null,
    working: false,
    _watch() {
      tasks.forEach(v => { v._watch(); })
    },
    _run(prevLastRun) {
      if (this.working) return;
      this.working = true;
      try {
        const prevUpdateTime = this.updateTime;
        const promises = tasks.reduce((acc, t) => {
          if (!t) return acc; // empty
          if ((t.lastRun === null) || // it's first time
            (prevLastRun !== null && t.lastRun < prevLastRun) || // previous task result was updated
            (typeof t.updateTime === 'number' && t.updateTime >= t.lastRun)) { // there was a signal from 'watch' to run this task again
            acc.push(t._run(prevLastRun));
          }
          return acc;
        }, []);
        return awaitAll(promises)
          .then(() => {
            if (!restartTasks && prevUpdateTime === this.updateTime) this.lastRun = Date.now(); // there was NO a watch event while task was running
          })
          .finally(() => {
            this.working = false;
          });
      } catch (err) {
        console.error(err)
      }
    }
  };
  tasks.forEach(v => {
    v && (v.parent = task);
  });
  return task;
}

function serial(tasks) {
  tasks = tasks.filter(v => typeof v === 'object' && v !== null && '_run' in v);
  const task = {
    lastRun: null,
    working: false,
    _watch() {
      tasks.forEach(v => { v._watch(); })
    },
    _run() {
      if (this.working) return;
      this.working = true;
      const prevUpdateTime = this.updateTime
      return (new Promise((resolve, reject) => {
        return _serial(tasks, resolve, reject)
      }))
        .then(() => {
          if (!restartTasks && prevUpdateTime === this.updateTime) this.lastRun = Date.now(); // there was NO a watch event while task was running
        })
        .finally(() => {
          this.working = false;
        });
    }
  };
  tasks.forEach(v => {
    v && (v.parent = task);
  });
  return task;
}

function _serial(tasks, resolve, reject) {
  if (!Array.isArray(tasks)) throw new Error(`Invalid argument 'tasks': %{tasks}`);
  let prevLastRun = null;
  const task = tasks.find((t, i) => {
    if (!t) return; // empty
    if (t.lastRun === null) return true; // it's first time
    if (i > 0) {
      prevLastRun = tasks[i - 1].lastRun;
      if (t.lastRun < prevLastRun) return true; // previous task result was updated
    }
    if (typeof t.updateTime === 'number' && t.updateTime >= t.lastRun) return true; // there was a signal from 'watch' to run this task again
  });
  if (task) {
    const prevUpdateTime = this.updateTime;
    task._run(prevLastRun).then(
      () => {
        if (prevUpdateTime === task.updateTime) task.lastRun = Date.now(); // there was NO a watch event while task was running
        if (restartTasks) {
          resolve();
          return;
        }
        _serial(tasks, resolve, reject);
      },
      (err) => {
        reject(err);
      });
  } else {
    resolve();
  }
}

module.exports = {
  Task,
  runTasks,
  serial,
  parallel,
};
module.exports.default = runTasks;

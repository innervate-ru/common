import path from 'path'
import chokidar from 'chokidar'
import cmd from 'commander'
import {parallel, runTasks, serial, spawn, Task} from '../../build/index'

cmd
  .name(`node src/common/docs/scripts/docsTest.js`)
  .option(`-d, --dev`, `development mode`)
  .parse(process.argv);

export const task = serial([
  require('../../../../scripts/taskCompileModel').default({
    fromDir: 'src/common/docs/model.test',
    toDir: 'src/common/docs/data.test'
  }),
  require('../../../../scripts/taskGenerateDBSchema').default({
    fromDir: 'src/common/docs/data.test',
    toDir: 'src/common/docs/dbEvolutionsSchema.test/schema',
    modelDir: 'src/common/docs/model.test'
  }),
  new Task({
    name: 'Update DB',
    async run() {
      process.env.NODE_ENV = 'test';
      await require('../../postgres/updateDatabase').default;
    },
  }),
  new Task({
    name: `ava 'src/common/docs/index.test.js'`,
    run() {
      return spawn('node', ['node_modules/ava/cli.js', path.join(process.cwd(), 'src/common/docs/index.test.js')]);
    },
    watch(cb) {
      chokidar.watch(path.join(process.cwd(), 'src/common/docs/*.js'), {ignoreInitial: true}).on('all', cb);
      chokidar.watch(path.join(process.cwd(), 'src/common/docs/dbEvolutionsSchema.test/*.sql'), {ignoreInitial: true}).on('all', cb);
    },
  }),
]);

runTasks({

  watch: cmd.dev,

  // delay: 1000,

  tasks: task,
});

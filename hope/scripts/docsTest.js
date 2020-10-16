import path from 'path'
import chokidar from 'chokidar'
import cmd from 'commander'
import {parallel, runTasks, serial, spawn, Task} from '../../build/index'

cmd
  .name(`node src/common/hope/scripts/docsTest.js`)
  .option(`-d, --dev`, `development mode`)
  .parse(process.argv);

export const task = serial([
  require('./taskCompileModel').default({
    fromDir: 'src/common/hope/model.test',
    toDir: 'src/common/hope/data.test'
  }),
  require('./taskGenerateDBSchema').default({
    fromDir: 'src/common/hope/data.test',
    toDir: 'src/common/hope/dbEvolutionsSchema.test/schema',
    modelDir: 'src/common/hope/model.test'
  }),
  new Task({
    name: 'Update DB',
    async run() {
      process.env.NODE_ENV = 'test';
      await require('../../postgres/updateDatabase').default;
    },
  }),
  new Task({
    name: `ava 'src/common/hope/index.test.js'`,
    run() {
      return spawn('node', ['node_modules/ava/cli.js', path.join(process.cwd(), 'src/common/hope/index.test.js')]);
    },
    watch(cb) {
      chokidar.watch(path.join(process.cwd(), 'src/common/hope/*.js'), {ignoreInitial: true}).on('all', cb);
      chokidar.watch(path.join(process.cwd(), 'src/common/hope/dbEvolutionsSchema.test/!*.sql'), {ignoreInitial: true}).on('all', cb);
    },
  }),
]);

runTasks({

  watch: cmd.dev,

  // delay: 1000,

  tasks: task,
});

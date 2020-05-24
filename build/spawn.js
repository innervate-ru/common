const {spawn: realSpawn} = require('child_process');

function spawn(command, args, options) {
  return new Promise((resolve, reject) => {
    const p = realSpawn(command, args || [], Object.assign({
      stdio: [process.stdin, process.stdout, process.stderr],
    }, options));
    p.on('error', (err) => reject(err));
    p.on('exit', () => {
      p.exitCode !== 0 ? reject(new Error(`exitCode: ${p.exitCode}`)) : resolve(p);
    });
  });
}

module.exports = spawn;
module.exports.default = spawn;

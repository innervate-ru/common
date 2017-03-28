import moment from 'moment'
import colors from 'colors'

let console_error = console.error;
let console_info = console.info;
let console_log = console.log;

console.error = function(message) {
  let args = [`${colors.yellow(moment().format('YYYY-MM-DD HH:ss.SSS:'))} ${colors.red('[ERROR]:')} ${message}`];
  for (let i = 1; i < arguments.length; i++) args.push(arguments[i]);
  console_error.apply(console, args);
};

console.info = function(message) {
  let args = [`${colors.yellow(moment().format('YYYY-MM-DD HH:ss.SSS:'))} ${colors.green('[INFO]:')} ${message}`];
  for (let i = 1; i < arguments.length; i++) args.push(arguments[i]);
  console_info.apply(console, args);
};

console.log = function(message) {
  let args = [`${colors.yellow(moment().format('YYYY-MM-DD HH:ss.SSS:'))} ${message}`];
  for (let i = 1; i < arguments.length; i++) args.push(arguments[i]);
  console_log.apply(console, args);
};

import {missingArgument, invalidArgument} from '../validation'

export default function fixSpaces(string = missingArgument('string')) {
  return string.trim().replace(/\s{2,}/g, ' ');
}

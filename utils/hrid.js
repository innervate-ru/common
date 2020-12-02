import { customAlphabet } from 'nanoid'
const dictionary = require('nanoid-dictionary');

const nanoid = customAlphabet(dictionary.nolookalikes, 21);

export default function hrid() {
  return nanoid();
}

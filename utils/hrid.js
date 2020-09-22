const generate = require('nanoid/generate');
const dictionary = require('nanoid-dictionary');

export default function hrid() {
  return generate(dictionary.nolookalikes, 21);
}

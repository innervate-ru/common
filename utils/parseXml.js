import xml2js from 'xml2js'

export default async function parseXml(xml) {
  return new Promise(function (resolve, reject) {
    xml2js.parseString(xml, function (err, result) {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    })
  })
}

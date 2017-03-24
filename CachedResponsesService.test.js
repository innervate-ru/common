// Важно: При изменении класса и тестов, обязательно по завершению работы выполнить npm run coverage и посмотреть покрытие кода!

import test from 'ava'
import path from 'path'

import CachedResponsesService from './CachedResponsesService'

const _testFilename = path.join(path.relative(process.cwd(), __dirname), path.basename(__filename, '.js'));

const REUSE_RESULT_TIME = 3 * 60 * 1000;
const REUSE_RESULT_ON_ERROR_TIME = 1 * 60 * 1000;
const MAX_PARALLEL_REQUESTS = 3;

class TestSvc extends CachedResponsesService {

  __loadCount = 0;
  __time = 1000;

  constructor(opts) {

    super({
      reuseResultTime: REUSE_RESULT_TIME,
      reuseResultOnErrorTime: REUSE_RESULT_ON_ERROR_TIME,
      maxParallelRequests: (opts && opts.hasOwnProperty('maxParallelRequests')) ? opts.maxParallelRequests : MAX_PARALLEL_REQUESTS,
      now: () => this.__time,
    });
  }

  __error = null;
  _responseQueue = null;

  async _load(args) {
    ++this.__loadCount;
    if (this.__error) throw this.__error;
    if (this.__responseQueue) {
      return new Promise((resolve, reject) => {
        this.__responseQueue.push({args, resolve, reject});
      });
    }
    return args;
  }
}

async function getSVC(opts) {
  let svc = new TestSvc(opts);
  svc._init(); // без await так как _init для сервиса не переопределн в наследнике
  return svc;
}

test(`${_testFilename}: неправильный параметр в конструктор`, async t => {
  t.throws(() => new CachedResponsesService(false));
  t.throws(() => new CachedResponsesService(1));
  t.throws(() => new CachedResponsesService(null));
  t.throws(() => new CachedResponsesService([]));
});

test(`${_testFilename}: неизвестная опция в конструктор`, async t => {
  t.throws(() => new CachedResponsesService({__nothing__: true}));
});

test(`${_testFilename}: пропущенный параметр метода`, async t => {
  let svc = new CachedResponsesService();
  t.throws(() => svc._find());
  t.throws(() => svc._argsToKey());
});

test(`${_testFilename}: простая проверка`, async t => {
  let svc = await getSVC();
  t.is(svc.__loadCount, 0);
  let r = await svc._find('123');
  t.is(svc.__loadCount, 1);
});

test(`${_testFilename}: загрузка данных прошла с ошибкой`, async t => {
  let svc = await getSVC();

  // если это первая загрузка для данных параметров, то возвращается null
  svc.__error = new Error();
  t.is(await svc._find('987'), null);

  svc.__time += REUSE_RESULT_TIME + 10; // если время не передвинуть, то не будет использовано просто данные из кеша
  svc.__error = null;
  t.is(await svc._find('987'), '987');

  // если ранее были загруженны данные для данных параметров, то используется предыдущее значение
  svc.__time += REUSE_RESULT_TIME + 10;
  svc.__error = new Error();
  t.is(await svc._find('987'), '987');

  t.is(svc.__loadCount, 3);
});

test(`${_testFilename}: кеш для каждого значения отдельный`, async t => {
  let svc = await getSVC();
  t.is(await svc._find('123'), '123');
  t.is(await svc._find('123'), '123');
  t.is(await svc._find('123'), '123');
  t.is(await svc._find('abc'), 'abc');
  // два повторных запроса из кеша и один новый
  t.is(svc.__loadCount, 2);
});

test(`${_testFilename}: если загрузка данных для элемента в процессе, то параллельные запросы встают в очередь`, async t => {
  let svc = await getSVC();
  svc.__responseQueue = [];
  let callA = svc._find('123');
  let callB = svc._find('123');
  let callC = svc._find('123');
  svc.__responseQueue.shift().resolve('res');
  t.is(await callA, 'res');
  t.is(await callB, 'res');
  t.is(await callC, 'res');
  t.is(svc.__loadCount, 1);
});

test(`${_testFilename}: если количество требуемых запросов превышает MAX_PARALLEL_REQUESTS, то запросы становятся в очередь ожидания`, async t => {
  let svc = await getSVC();
  svc.__responseQueue = [];

  let callA = svc._find('1');
  let callB = svc._find('2');
  let callC = svc._find('3');
  let callD = svc._find('4');
  let callE = svc._find('5');

  t.is(svc.__loadCount, 3); // еще одно обрашение в очереди, так как MAX_PARALLEL_REQUESTS == 3

  svc.__responseQueue.shift().resolve('A');
  t.is(await callA, 'A'); // надо сделать await чтоб все последствия resolve сработали

  t.is(svc.__loadCount, 4);

  svc.__responseQueue.shift().resolve('B');
  t.is(await callB, 'B');

  t.is(svc.__loadCount, 5);

  svc.__responseQueue.shift().resolve('C');
  t.is(await callC, 'C');
  svc.__responseQueue.shift().resolve('D');
  t.is(await callD, 'D');
  svc.__responseQueue.shift().resolve('E');
  t.is(await callE, 'E');

  t.is(svc.__loadCount, 5);
});

test(`${_testFilename}: если нет ограничения по очереди, то очередь не используется`, async t => {
  let svc = await getSVC({maxParallelRequests: 0});
  svc.__responseQueue = [];

  let callA = svc._find('1');
  let callB = svc._find('2');
  let callC = svc._find('3');
  let callD = svc._find('4');
  let callE = svc._find('5');

  t.is(svc.__loadCount, 5); // сколько было обращений, все в работе

  svc.__responseQueue.shift().resolve('A');
  t.is(await callA, 'A'); // надо сделать await чтоб все последствия resolve сработали
  svc.__responseQueue.shift().resolve('B');
  t.is(await callB, 'B');
  svc.__responseQueue.shift().resolve('C');
  t.is(await callC, 'C');
  svc.__responseQueue.shift().resolve('D');
  t.is(await callD, 'D');
  svc.__responseQueue.shift().resolve('E');
  t.is(await callE, 'E');

  t.is(svc.__loadCount, 5);
});



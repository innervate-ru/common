import test from 'ava'
import sinon from 'sinon'

import oncePerServices from './oncePerServices'

test(`метод для одного и того же объекта services вызывается только один раз`, t => {
  const services = Object.create(null);
  const method = sinon.spy();

  oncePerServices(method)(services);
  oncePerServices(method)(services);

  t.true(method.calledOnce);
});

test(`для разных объектов services метод вызвается отдельно`, t => {
  const services1 = Object.create(null);
  const services2 = Object.create(null);
  const method = sinon.stub().returns(1);

  t.is(oncePerServices(method)(services1), 1);
  t.is(oncePerServices(method)(services2), 1);

  t.is(method.callCount, 2);

});

test(`для одного и того же объекта services, разные методы вызываются`, t => {
  const services = Object.create(null);
  const method1 = sinon.stub().returns(1);
  const method2 = sinon.stub().returns(2);

  t.is(oncePerServices(method1)(services), 1);
  t.is(oncePerServices(method2)(services), 2);

  t.true(method1.calledOnce);
  t.true(method2.calledOnce);
});


test(`oncePerService пропускает через себя ошибки, и так же как результат запоминает и возвращает ошибки при повторном вызове`, t => {
  const services = Object.create(null);
  const method = sinon.stub().throws(new Error('test error'));

  t.throws(() => oncePerServices(method)(services), 'test error');
  t.throws(() => oncePerServices(method)(services), 'test error');

  t.true(method.calledOnce);
});


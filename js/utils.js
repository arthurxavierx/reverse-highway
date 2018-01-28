/* eslint-disable no-undef, no-unused-vars */
'use strict';

const $ = document.querySelectorAll.bind(document);
const $$ = document.querySelector.bind(document);

const tap = f => x => (f(x), x);
const log = tap(console.log);  // eslint-disable-line no-console

Array.prototype.head = function() {
  return this[0];
};
Array.prototype.tail = function() {
  return this.slice(1);
};
Array.prototype.last = function() {
  return this[this.length - 1];
};

Array.prototype.flatMap = function(f) {
  const r = [];
  for (let i = 0; i < this.length; i++) {
    const x = f(this[i], i);
    for (let j = 0; j < x.length; j++)
      r.push(x[j]);
  }
  return r;
};

// TODO: optimize these
const sum = arr => arr.reduce((acc, x) => acc + x, 0);
const sums = (arr1, arr2) => zip(arr1, arr2).map(sum);
const avg = arr => arr.reduce((acc, x) => acc + x / arr.length, 0);
const sub = arr => arr.reduce((acc, x) => acc - x, arr[0]) + arr[0];
const subs = (arr1, arr2) => zip(arr1, arr2).map(sub);

const groupByN = (arr, n) => {
  const r = [];
  for (let i = 0; i < arr.length; i += n)
    r.push(arr.slice(i, Math.min(arr.length, i + n)));
  return r;
};

const zip = (arr1, arr2) => {
  const r = [], len = Math.min(arr1.length, arr2.length);
  for (let i = 0; i < len; i++)
    r.push([arr1[i], arr2[i]]);
  return r;
};

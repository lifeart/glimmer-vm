import { dict } from 'glimmer-util';

export const EMPTY_ARRAY = [];
export const EMPTY_DICT = dict<any>();

export function turbocharge(object: Object): Object {
  // function Constructor() {}
  // Constructor.prototype = object;
  return object;
}

interface EnumerableCallback<T> {
  (item: T): void;
}

export interface Enumerable<T> {
  forEach(callback: EnumerableCallback<T>);
}

export interface Destroyable {
  destroy();
}

export interface Range<T> {
  min(): number;
  max(): number;
  at(index: number): T;
}

export class ListRange<T> implements Range<T> {
  private list: T[];

  // [start, end]
  private start: number;
  private end: number;

  constructor(list: T[], start: number, end: number) {
    this.list = list;
    this.start = start;
    this.end = end;
  }

  at(index: number): T {
    if (index >= this.list.length) return null;
    return this.list[index];
  }

  min(): number {
    return this.start;
  }

  max(): number {
    return this.end;
  }
}

import { describe, expect, it } from 'vitest';
import { parseCsv, readCsvRecords, toCsv } from './csv';

describe('parseCsv', () => {
  it('handles quotes, commas and line breaks inside cells', () => {
    expect(parseCsv('a,"b, c","say ""hi""\nthere"\r\nd,e,f')).toEqual([
      ['a', 'b, c', 'say "hi"\nthere'],
      ['d', 'e', 'f'],
    ]);
  });

  it('drops a byte order mark and keeps empty cells', () => {
    expect(parseCsv('﻿id,name\n,Jane\n')).toEqual([
      ['id', 'name'],
      ['', 'Jane'],
    ]);
  });
});

describe('toCsv', () => {
  it('round-trips through parseCsv', () => {
    const rows = [
      ['id', 'quote'],
      ['1', 'It was "lovely", truly.\nThank you.'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe('readCsvRecords', () => {
  it('matches headers loosely and numbers rows like the sheet', () => {
    const { records, missing } = readCsvRecords('Name,Role,Extra\nJane,Founder,x\n,,\nSam,,', [
      'id',
      'name',
      'role',
    ]);
    expect(missing).toEqual(['id']);
    expect(records).toEqual([
      { row: 2, values: { id: '', name: 'Jane', role: 'Founder' } },
      { row: 4, values: { id: '', name: 'Sam', role: '' } },
    ]);
  });

  it('stores line breaks inside cells as plain newlines', () => {
    const { records } = readCsvRecords('bio\r\n"one\r\ntwo"\r\n', ['bio']);
    expect(records[0]!.values.bio).toBe('one\ntwo');
  });
});

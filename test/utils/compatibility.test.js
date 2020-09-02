import fs from 'fs';
import path from 'path';

import {
  getContentLength,
  getUnknownContentType,
} from '../../src/utils/compatibility';

describe('testing buffers and non buffers', () => {
  // content.length < 1000
  const content = 'hello world';
  // content.length > 1000
  const longContent = content.repeat(100);
  // buffer
  const buffer = fs.readFileSync(
    path.resolve(__dirname, '../fixtures/index.html')
  );

  const contents = [
    {
      title: 'testing non-buffer content',
      content,
      contentType: 'text/html; charset=utf-8',
      length: content.length,
    },
    {
      title: 'testing long non-buffer content',
      content: longContent,
      contentType: 'text/html; charset=utf-8',
      length: longContent.length,
    },
    {
      title: 'testing buffer content',
      content: buffer,
      contentType: 'application/octet-stream',
      length: buffer.byteLength,
    },
  ];

  describe('testing getContentLength', () => {
    contents.forEach((content) => {
      it(content.title, () => {
        expect(getContentLength(content.content)).toBe(content.length);
      });
    });
  });

  describe('testing getUnknownContentType', () => {
    contents.forEach((content) => {
      it(content.title, () => {
        expect(getUnknownContentType(content.content)).toBe(
          content.contentType
        );
      });
    });
  });
});

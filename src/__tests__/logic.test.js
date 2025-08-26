const fs = require('fs');
const glob = require('glob');
const core = require('@actions/core');
const logic = require('../logic');

// Mock the core module
jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn()
}));

// Mock the fs module
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
}));

// Mock the glob module
jest.mock('glob', () => ({
  sync: jest.fn()
}));

describe('pytest-json-converter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('expand', () => {
    it('should return matching files', () => {
      const mockFiles = ['coverage1.json', 'coverage2.json'];
      glob.sync.mockReturnValue(mockFiles);

      const result = logic.expand('*.json');
      expect(result).toEqual(mockFiles);
      expect(glob.sync).toHaveBeenCalledWith('*.json');
    });

    it('should throw error when no files found', () => {
      glob.sync.mockReturnValue([]);
      expect(() => logic.expand('*.json')).toThrow('No coverage files found matching pattern: *.json');
    });
  });

  describe('read', () => {
    it('should read and parse JSON files', () => {
      const mockFiles = ['file1.json', 'file2.json'];
      const mockContents = [
        { one: { coverage: { 'file1.rb': { lines: [1, 1, 1] } } } },
        { two: { coverage: { 'file2.rb': { lines: [1, 0, 1] } } } }
      ];

      fs.readFileSync
        .mockReturnValueOnce(JSON.stringify(mockContents[0]))
        .mockReturnValueOnce(JSON.stringify(mockContents[1]));

      const result = logic.read(mockFiles);
      expect(result).toEqual(mockContents);
      expect(fs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('convertFormat', () => {
    it('converts format', () => {
      const input = [
        {'file1.py': {executed_lines: [1, 4], missing_lines: [2]}},
        {'file2.py': {executed_lines: [1, 2, 3, 4], missing_lines: [5, 6, 7]}},
        {'file3.py': {executed_lines: [1], missing_lines: [3]}, 'file4.py': {executed_lines: [2], missing_lines: []}}
      ];
      const expected = [
        {'file1.py': [1, 0, null, 1]},
        {'file2.py': [1, 1, 1, 1, 0, 0, 0]},
        {'file3.py': [1, null, 0]},
        {'file4.py': [null, 1]}
      ];
      const result = logic.convertFormat(...input);
      expect(result).toEqual(expected);
    })
  })

  describe('combine', () => {
    it('combines two test runs', () => {
      const one = [1, 1, 1];
      const two = [null, 1, 2];
      const expected = [1, 2, 3];
      const result = logic.combine(one, two);
      expect(result).toEqual(expected);
    })
  })

  describe('sum', () => {
    it('sums the same way as SimpleCov', () => {
      expect(logic.sum(null, null)).toEqual(null);
      expect(logic.sum(null, 0)).toEqual(null);
      expect(logic.sum(0, null)).toEqual(null);
      expect(logic.sum(0, 0)).toEqual(0);
      expect(logic.sum(null, 1)).toEqual(1);
      expect(logic.sum(1, null)).toEqual(1);
      expect(logic.sum(1, 0)).toEqual(1);
      expect(logic.sum(0, 1)).toEqual(1);
      expect(logic.sum(1, 1)).toEqual(2);
      expect(logic.sum(1, 2)).toEqual(3);
    })
  })

  describe('merge', () => {
    it('handles single file', () => {
      const inputs = [
        {'file1.rb': [1, 1, 0]},
      ];

      const expected = {'file1.rb': [1, 1, 0]};

      const result = logic.merge(inputs);
      expect(result).toEqual(expected);
    });

    it('should merge coverage data from multiple files', () => {
      const inputs = [
        {'file1.rb': [1, 1, 0]},
        {'file2.rb': [1, 0, 1]},
      ];

      const expected = {
        'file1.rb': [1, 1, 0],
        'file2.rb': [1, 0, 1],
      };

      const result = logic.merge(inputs);
      expect(result).toEqual(expected);
    });

    it('should merge coverage data from multiple files and runs', () => {
      const inputs = [
        {'file1.rb': [1, 1, 0]},
        {'file2.rb': [1, 0, 1]},
        {
          'file1.rb': [1, 1, 1],
          'file3.rb': [1, 1, 0]
        }
      ];

      const expected = {
        'file1.rb': [2, 2, 1],
        'file2.rb': [1, 0, 1],
        'file3.rb': [1, 1, 0]
      };

      const result = logic.merge(inputs);
      expect(result).toEqual(expected);
    });

    it('behaves identically to SimpleCov when combining', () => {
      const inputs = [
        {'file1.rb': [null,null,1,null,1,1,1,1,null,1,1,1,null,1,null,1,null,1,0,0,null,null,null,null,1,0,null,null,0,null,0,null,0,null,null,0,null,null,1,0,0,0,null,null,null,null,null]},
        {'file1.rb': [null,null,1,null,1,1,1,1,null,1,10,1,null,1,null,1,null,1,30,30,null,null,null,null,1,18,null,null,18,null,9,null,9,null,null,18,null,null,1,0,0,0,null,null,null,null,null]}
      ];

      const expected = {'file1.rb': [null,null,2,null,2,2,2,2,null,2,11,2,null,2,null,2,null,2,30,30,null,null,null,null,2,18,null,null,18,null,9,null,9,null,null,18,null,null,2,0,0,0,null,null,null,null,null]};

      const result = logic.merge(inputs);
      expect(result).toEqual(expected);
    })
  });

  describe('removePrefixes', () => {
    it('should remove common prefix from filenames', () => {
      const input = {
        '/foo/bar.js': [1, 2, 3],
        '/foo/foo/asdf.js': [2, 3, 4]
      };

      const expected = {
        '/bar.js': [1, 2, 3],
        '/foo/asdf.js': [2, 3, 4]
      }

      const result = logic.removePrefixes(input, '/foo');
      expect(result).toEqual(expected);
    });

    it('should no change input when prefix is not provided', () => {
      const input = {
        '/foo/bar.js': [1, 2, 3],
        '/foo/foo/asdf.js': [2, 3, 4]
      };

      const expected = input;

      const result = logic.removePrefixes(input, '');
      expect(result).toEqual(expected);
    })
  });

  describe('run', () => {
    it('should process coverage files successfully', () => {
      const mockPattern = '**/coverage.json';
      const mockFiles = ['coverage.json'];
      const mockContent = { 'files': { 'file.py': { 'executed_lines': [1, 2], 'missing_lines': [4] } } };
      const expected = {
        'file.py': [1, 1, null, 0]
      }

      core.getInput.mockReturnValue(mockPattern);
      glob.sync.mockReturnValue(mockFiles);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockContent));

      logic.run();

      expect(core.getInput).toHaveBeenCalledWith('coverage-file');
      expect(glob.sync).toHaveBeenCalledWith(mockPattern);
      expect(fs.readFileSync).toHaveBeenCalledWith(mockFiles[0], 'utf8');
      expect(core.setOutput).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledWith('coverage.json', JSON.stringify(expected, null, 2));
    });

    it('strips github_workspace', () => {
      const mockPattern = '**/coverage.json';
      const mockFiles = ['coverage.json'];
      const mockContent = { 'files': { '/github/workspace/src/file.py': { 'executed_lines': [1, 2], 'missing_lines': [4] } } };
      const expected = {
        'src/file.py': [1, 1, null, 0]
      }
      // mock core.getInput("coverage-file") call
      core.getInput.mockReturnValueOnce(mockPattern);
      core.getInput.mockReturnValueOnce('github_workspace');
      process.env.GITHUB_WORKSPACE = '/github/workspace';
      glob.sync.mockReturnValue(mockFiles);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockContent));

      logic.run();

      expect(fs.writeFileSync).toHaveBeenCalledWith('coverage.json', JSON.stringify(expected, null, 2));

      process.env.GITHUB_WORKSPACE = undefined;
    })

    it('should handle errors', () => {
      const error = new Error('Test error');
      core.getInput.mockImplementation(() => { throw error; });

      logic.run();

      expect(core.setFailed).toHaveBeenCalledWith(error.message);
    });
  });
});

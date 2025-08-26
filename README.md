# Coverage Converter for Pytest

This is a simple GitHub action that takes (one or more) Pytest JSON `coverage.json` files and produces a single combined document.

## Generating Coverage

Install `pytest-cov` and run:
```
$ python -m pytest src/ --cov=src --cov-report=json
```

## Usage

To use in a Github workflow, run your tests as normal, then add the following step:
```yaml
    - uses: madleech/coverage-converter-pytest-json
```

This will read in `coverage.json` from Pytest and produce (a different) `coverage.json` with the following format:
```json
{
  "test.py": [null, null, 1, 1, 0, null]
}
```

## Combining Multiple Resultsets

If you're running your test suite in parallel, you'll likely end up with multiple `coverage.json` files which need combining. This action can handle it automatically:

```yaml
    - uses: madleech/coverage-converter-pytest-json
      with:
        coverage-file: "**/coverage.json"
```

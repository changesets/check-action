# Changesets Release Action

This action for [Changesets](https://github.com/atlassian/changesets) comments on PRs with whether a PR has a changeset or not and links to documentation explaining to contributors how to create a changeset.

## Usage

Create a file at `.github/workflows/changeset-check.yml` with the following content.

```yml
name: Changeset Check

on: pull_request

jobs:
  check:
    name: Changeset Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@master
      - name: Comment on PR
        uses: changesets/check-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

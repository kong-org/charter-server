## charter-server

`charter-server` is adapted from `interdependence-server` from [verses-xyz](https://github.com/verses-xyz). We've removed functions relating to forking for a simple document signing app that stores offchain signatures on Arweave.

Setup:

Copy `.env_template` to `.env` and fill in the API keys. Note: you need `Elevated` access on your Twitter API keys in order to access the necessary endpoint for Tweet verification.

```
npm install
node index.js
```

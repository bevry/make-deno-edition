<!-- TITLE/ -->

# make-deno-edition

<!-- /TITLE -->

<!-- BADGES/ -->

<span class="badge-githubworkflow"><a href="https://github.com/bevry/make-deno-edition/actions?query=workflow%3Abevry" title="View the status of this project's GitHub Workflow: bevry"><img src="https://github.com/bevry/make-deno-edition/workflows/bevry/badge.svg" alt="Status of the GitHub Workflow: bevry" /></a></span>
<span class="badge-npmversion"><a href="https://npmjs.org/package/make-deno-edition" title="View this project on NPM"><img src="https://img.shields.io/npm/v/make-deno-edition.svg" alt="NPM version" /></a></span>
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/make-deno-edition" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/make-deno-edition.svg" alt="NPM downloads" /></a></span>
<br class="badge-separator" />
<span class="badge-githubsponsors"><a href="https://github.com/sponsors/balupton" title="Donate to this project using GitHub Sponsors"><img src="https://img.shields.io/badge/github-donate-yellow.svg" alt="GitHub Sponsors donate button" /></a></span>
<span class="badge-thanksdev"><a href="https://thanks.dev/u/gh/bevry" title="Donate to this project using ThanksDev"><img src="https://img.shields.io/badge/thanksdev-donate-yellow.svg" alt="ThanksDev donate button" /></a></span>
<span class="badge-patreon"><a href="https://patreon.com/bevry" title="Donate to this project using Patreon"><img src="https://img.shields.io/badge/patreon-donate-yellow.svg" alt="Patreon donate button" /></a></span>
<span class="badge-liberapay"><a href="https://liberapay.com/bevry" title="Donate to this project using Liberapay"><img src="https://img.shields.io/badge/liberapay-donate-yellow.svg" alt="Liberapay donate button" /></a></span>
<span class="badge-buymeacoffee"><a href="https://buymeacoffee.com/balupton" title="Donate to this project using Buy Me A Coffee"><img src="https://img.shields.io/badge/buy%20me%20a%20coffee-donate-yellow.svg" alt="Buy Me A Coffee donate button" /></a></span>
<span class="badge-opencollective"><a href="https://opencollective.com/bevry" title="Donate to this project using Open Collective"><img src="https://img.shields.io/badge/open%20collective-donate-yellow.svg" alt="Open Collective donate button" /></a></span>
<span class="badge-crypto"><a href="https://bevry.me/crypto" title="Donate to this project using Cryptocurrency"><img src="https://img.shields.io/badge/crypto-donate-yellow.svg" alt="crypto donate button" /></a></span>
<span class="badge-paypal"><a href="https://bevry.me/paypal" title="Donate to this project using Paypal"><img src="https://img.shields.io/badge/paypal-donate-yellow.svg" alt="PayPal donate button" /></a></span>
<br class="badge-separator" />
<span class="badge-discord"><a href="https://discord.gg/nQuXddV7VP" title="Join this project's community on Discord"><img src="https://img.shields.io/discord/1147436445783560193?logo=discord&amp;label=discord" alt="Discord server badge" /></a></span>
<span class="badge-twitch"><a href="https://www.twitch.tv/balupton" title="Join this project's community on Twitch"><img src="https://img.shields.io/twitch/status/balupton?logo=twitch" alt="Twitch community badge" /></a></span>

<!-- /BADGES -->

<!-- DESCRIPTION/ -->

Automatically makes package.json projects (such as npm packages and node.js modules) compatible with Deno.

<!-- /DESCRIPTION -->


## Overview

### Examples

[Here is the growing list of all the packages that make-deno-edition has made compatible with Deno.](https://www.npmjs.com/search?q=keywords:deno-entry)

### The Need

**Node.js and TypeScript support unresolved paths**, e.g. `import thing from './file'` and `import thing from './'`. **Deno however, only supports resolved paths**, e.g. `import thing from './file.ts'` and `import thing from 'https://unpkg.com/badges@^4.13.0/edition-deno/index.ts'`. This means that anything imported into Deno must be directly resolvable and must use ECMAScript Modules (ESM).

**Node.js and TypeScript support `package.json` files** to specify dependency versions, which enables code like `import dep from 'dep'`. **Deno however, has no conception of `package.json`**, so all dependencies must be imported via a directly resolvable CDN URL, e.g. `import dep from 'https://unpkg.com/dep@^1.0.0/file.ts'`.

**Deno and Node.js different on their APIs**. Node.js builtins can be converted to Deno's `std/node` builtins, however several things such as `__filename`, `__dirname` require a polyfill, and other things have no direct compatibility so require different entries.

In the end, **you must hope your dependencies are also compatible with Deno.**

### The Solution

make-deno-edition is a CLI tool that takes your source edition (whichever directory contains your package's typescript source files) and creates a compatible deno edition in a `edition-deno` directory.

It provides this compatibility by providing the following transformations:

1. bultin imports (e.g. `fs`) are mapped to their corresponding deno `node:*` polyfill

1. certain globals (e.g. `__filename` and `__dirname`) are mapped to their corresponding deno userland polyfilll

1. internal imports (any relative path to another file inside your source edition) are mapped to their typescript file, e.g. `import thing from './file'` and `import thing from './file.js'` becomes `import thing from './file.ts`

1. remote imports (e.g. any URL) are assumed to be compatible, as node.js doesn't support them, so it is assumed they are already deno compatible

1. dependency imports (e.g. any package you install into node_modules) are supported by:

    1. If they have a `deno` field in their `package.json`, which will denote where to look for the deno compatible entry file, then it's direct unpkg URL will be used.

        The more dependencies that `make-deno-edition` is run on, then the more dependencies will automatically have a `deno` entry field, and thus the more dependencies will be automatically compatible with Deno, enabling more dependents to be automatically compatible with Deno.

    2. If they are an installed dependency, their esm.sh URL will be used.

    3. If they are an uninstalled dependency, the `npm:` prefix will be used.

make-deno-edition will also intelligently ignore compatibility for files that are not essential, such as your test and utility files, but fail if compatibility for an essential file, such as an entry file and its required modules fail

Finally, make-deno-edition will also update your `package.json` file with the details for the deno entry file, as well as the deno edition metadata, such that other packages and toolchains can make use of your deno compatibility.

## Usage

[Complete API Documentation.](http://master.make-deno-edition.bevry.surge.sh/docs/)

### Preparation

> If you are using [`boundation`](https://github.com/bevry/boundation) to automatically generate deno compatibility for your npm package, then you can skip this step.

If you haven't already done so, add the following [editions](https://editions.bevry.me) metadata to your `package.json` file:

```json
  "editions": [
    {
      "description": "TypeScript source code with Import for modules",
      "directory": "source",
      "entry": "index.ts",
      "tags": [
        "typescript",
        "import"
      ],
      "engines": false
    }
  ]
```

Make sure that the `directory` is where the source files are located, in the above example, they are located in a `source` directory, as it is with this repository.

Make sure that the `entry` is where the entry file is located within the edition directory, in the above example, the entry is `index.ts`, as it is with this repository.

### Executable

> If you are using [`boundation`](https://github.com/bevry/boundation) to automatically generate deno compatibility for your npm package, then you can skip this step.

Install `make-deno-edition` to your development dependencies using:

```bash
npm install --save-dev make-deno-edition
```

Then add a `compile` npm script to your `package.json` containing:

```
make-deno-edition --attempt
```

Alternatively, you can run it directly on your project via:

```
npx make-deno-edition --attempt
```

The `--attempt` flag will not emit a failure exit code if the deno edition generation was not successful. If you require a deno edition to be published, remove the `--attempt` flag.

### Publishing

> If you are using [`boundation`](https://github.com/bevry/boundation) to automatically generate compatible editions (web browsers, deno, multiple node.js versions) for your npm package, then you can skip this step.

> If you are using [`projectz`](https://github.com/bevry/projectz) to automatically generate your `README.md` content, then you can skip this step.

If a deno edition was successfully created, it will be located in the `edition-deno` directory with the metadata added to the `editions` array in your `package.json` and a `deno` entry field also added to your `package.json`.

Consumers of your package who use `make-deno-edition` on their own package, will now be able to use your package's deno edition to further their own deno compatibility.

You can also instruct consumers of your package to directly use your deno edition, by informing them of its presence in your `README.md` file. You can use [`projectz`](https://github.com/bevry/projectz) to automatically insert this information for them, or you can use the following template:

    <a href="https://deno.land" title="Deno is a secure runtime for JavaScript and TypeScript, it is an alternative for Node.js"><h3>Deno</h3></a>

    ``` typescript
    import pkg from 'https://unpkg.com/YOURPACKAGENAME@^VERSION/edition-deno/ENTRY.ts'
    ```

<!-- INSTALL/ -->

## Install

### [npm](https://npmjs.com "npm is a package manager for javascript")

#### Install Globally

-   Install: `npm install --global make-deno-edition`
-   Executable: `make-deno-edition`

#### Install Locally

-   Install: `npm install --save make-deno-edition`
-   Executable: `npx make-deno-edition`
-   Import: `import * as pkg from ('make-deno-edition')`
-   Require: `const pkg = require('make-deno-edition')`

### [Editions](https://editions.bevry.me "Editions are the best way to produce and consume packages you care about.")

This package is published with the following editions:
-   `make-deno-edition/source/index.ts` is [TypeScript](https://www.typescriptlang.org/ "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.") source code with [Import](https://babeljs.io/docs/learn-es2015/#modules "ECMAScript Modules") for modules
-   `make-deno-edition` aliases `make-deno-edition/edition-es2022/index.js`
-   `make-deno-edition/edition-es2022/index.js` is [TypeScript](https://www.typescriptlang.org/ "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.") compiled against [ES2022](https://en.wikipedia.org/wiki/ES2022 "ECMAScript 2022") for [Node.js](https://nodejs.org "Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine") 18 || 20 || 21 with [Require](https://nodejs.org/dist/latest-v5.x/docs/api/modules.html "Node/CJS Modules") for modules
-   `make-deno-edition/edition-es2022-esm/index.js` is [TypeScript](https://www.typescriptlang.org/ "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.") compiled against [ES2022](https://en.wikipedia.org/wiki/ES2022 "ECMAScript 2022") for [Node.js](https://nodejs.org "Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine") 18 || 20 || 21 with [Import](https://babeljs.io/docs/learn-es2015/#modules "ECMAScript Modules") for modules
-   `make-deno-edition/edition-types/index.d.ts` is [TypeScript](https://www.typescriptlang.org/ "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.") compiled Types with [Import](https://babeljs.io/docs/learn-es2015/#modules "ECMAScript Modules") for modules

<!-- /INSTALL -->

<!-- HISTORY/ -->

## History

[Discover the release history by heading on over to the `HISTORY.md` file.](https://github.com/bevry/make-deno-edition/blob/HEAD/HISTORY.md#files)

<!-- /HISTORY -->

<!-- BACKERS/ -->

## Backers

### Code

[Discover how to contribute via the `CONTRIBUTING.md` file.](https://github.com/bevry/make-deno-edition/blob/HEAD/CONTRIBUTING.md#files)

#### Authors

-   [Benjamin Lupton](https://balupton.com) — Accelerating collaborative wisdom.

#### Maintainers

-   [Benjamin Lupton](https://balupton.com) — Accelerating collaborative wisdom.

#### Contributors

-   [Benjamin Lupton](https://github.com/balupton) — [view contributions](https://github.com/bevry/make-deno-edition/commits?author=balupton "View the GitHub contributions of Benjamin Lupton on repository bevry/make-deno-edition")

### Finances

<span class="badge-githubsponsors"><a href="https://github.com/sponsors/balupton" title="Donate to this project using GitHub Sponsors"><img src="https://img.shields.io/badge/github-donate-yellow.svg" alt="GitHub Sponsors donate button" /></a></span>
<span class="badge-thanksdev"><a href="https://thanks.dev/u/gh/bevry" title="Donate to this project using ThanksDev"><img src="https://img.shields.io/badge/thanksdev-donate-yellow.svg" alt="ThanksDev donate button" /></a></span>
<span class="badge-patreon"><a href="https://patreon.com/bevry" title="Donate to this project using Patreon"><img src="https://img.shields.io/badge/patreon-donate-yellow.svg" alt="Patreon donate button" /></a></span>
<span class="badge-liberapay"><a href="https://liberapay.com/bevry" title="Donate to this project using Liberapay"><img src="https://img.shields.io/badge/liberapay-donate-yellow.svg" alt="Liberapay donate button" /></a></span>
<span class="badge-buymeacoffee"><a href="https://buymeacoffee.com/balupton" title="Donate to this project using Buy Me A Coffee"><img src="https://img.shields.io/badge/buy%20me%20a%20coffee-donate-yellow.svg" alt="Buy Me A Coffee donate button" /></a></span>
<span class="badge-opencollective"><a href="https://opencollective.com/bevry" title="Donate to this project using Open Collective"><img src="https://img.shields.io/badge/open%20collective-donate-yellow.svg" alt="Open Collective donate button" /></a></span>
<span class="badge-crypto"><a href="https://bevry.me/crypto" title="Donate to this project using Cryptocurrency"><img src="https://img.shields.io/badge/crypto-donate-yellow.svg" alt="crypto donate button" /></a></span>
<span class="badge-paypal"><a href="https://bevry.me/paypal" title="Donate to this project using Paypal"><img src="https://img.shields.io/badge/paypal-donate-yellow.svg" alt="PayPal donate button" /></a></span>

#### Sponsors

-   [Andrew Nesbitt](https://nesbitt.io) — Software engineer and researcher
-   [Balsa](https://balsa.com) — We're Balsa, and we're building tools for builders.
-   [Codecov](https://codecov.io) — Empower developers with tools to improve code quality and testing.
-   [Poonacha Medappa](https://poonachamedappa.com)
-   [Rob Morris](https://github.com/Rob-Morris)
-   [Sentry](https://sentry.io) — Real-time crash reporting for your web apps, mobile apps, and games.
-   [Syntax](https://syntax.fm) — Syntax Podcast

#### Donors

-   [Andrew Nesbitt](https://nesbitt.io)
-   [Armen Mkrtchian](https://mogoni.dev)
-   [Balsa](https://balsa.com)
-   [Chad](https://opencollective.com/chad8)
-   [Codecov](https://codecov.io)
-   [dr.dimitru](https://veliovgroup.com)
-   [Elliott Ditman](https://elliottditman.com)
-   [entroniq](https://gitlab.com/entroniq)
-   [GitHub](https://github.com/about)
-   [Hunter Beast](https://cryptoquick.com)
-   [Jean-Luc Geering](https://github.com/jlgeering)
-   [Michael Duane Mooring](https://mdm.cc)
-   [Michael Harry Scepaniak](https://michaelscepaniak.com)
-   [Mohammed Shah](https://github.com/smashah)
-   [Mr. Henry](https://mrhenry.be)
-   [Nermal](https://arjunaditya.vercel.app)
-   [Pleo](https://pleo.io)
-   [Poonacha Medappa](https://poonachamedappa.com)
-   [Rob Morris](https://github.com/Rob-Morris)
-   [Robert de Forest](https://github.com/rdeforest)
-   [Sentry](https://sentry.io)
-   [ServieJS](https://github.com/serviejs)
-   [Skunk Team](https://skunk.team)
-   [Syntax](https://syntax.fm)
-   [WriterJohnBuck](https://github.com/WriterJohnBuck)

<!-- /BACKERS -->

<!-- LICENSE/ -->

## License

Unless stated otherwise all works are:

-   Copyright &copy; [Benjamin Lupton](https://balupton.com)

and licensed under:

-   [Artistic License 2.0](http://spdx.org/licenses/Artistic-2.0.html)

<!-- /LICENSE -->

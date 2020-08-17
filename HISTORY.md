# History

## v1.0.2 2020 August 18

-   Fix `__dirname` detection (regression in v1.0.1)

## v1.0.1 2020 August 18

-   Add support for the deno `std/node/url` polyfill
-   Refresh the deno cache when attempting to run our conversions
-   Use Bevry's `__dirname` and `__filename` ponyfill as the community one disappeared
-   Do not use the `__dirname` and `__filename` ponyfill if they are manually set

## v1.0.0 2020 August 17

-   Bumped to v1 to show that is already stable and production ready, and has been used for [33 packages already](https://www.npmjs.com/search?q=keywords:deno-entry).
-   Now that [deno v1.3.0](https://github.com/denoland/deno/releases/tag/v1.3.0) is released with [pull request #6833](https://github.com/denoland/deno/pull/6833) merged, use that for `std/node/util` instead of the pull request directly
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v0.15.0 2020 June 25

-   Add support for `util.inspect` via [deno#6833](https://github.com/denoland/deno/pull/6833)
-   Add support for `__dirname` and `__filename` via [deno#2125](https://github.com/denoland/deno/issues/2125)
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v0.14.0 2020 June 25

-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v0.13.0 2020 June 25

-   Don't verify files work with deno on Travis CI (unless the new `--run` flag is provided) as it is likely Deno is not present on Travis CI

## v0.12.0 2020 June 25

-   Improvements to the stdout messages
-   Failed attempts will now output which files failed, and if `--verbose` is provided (or if it is running on Travis CI) then the complete details are also provided.

## v0.11.1 2020 June 25

-   Make binary have executable permissions which is reuqired for yarn environments

## v0.11.0 2020 June 25

-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v0.10.0 2020 June 22

-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v0.9.1 2020 June 21

-   Fix devDeps being merged into deps

## v0.9.0 2020 June 20

-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v0.8.1 2020 June 20

-   Support `export * from 'module'` statements

## v0.8.0 2020 June 20

-   Trim various fetch polyfills

## v0.7.0 2020 June 20

-   Allow required deno permissions to be specified via `package.json` keywords
-   Deno run commands are now outputted, and indentation is corrected
-   Changed `written` to `passed` to reflect v0.6.0 changes
-   If there is a `deno.ts` file inside the source edition, that is used as the deno entry instead

## v0.6.1 2020 June 20

-   Fix non-functional typo

## v0.6.0 2020 June 20

-   Now each made deno edition file is run against deno

## v0.5.1 2020 June 20

-   Fixed imports of the name as the package being mangled (regression since v0.4.0)

## v0.5.0 2020 June 20

-   Support `buffer` imports

## v0.4.2 2020 June 20

-   Fix non-functional typo

## v0.4.1 2020 June 20

-   Fix thrown errors not being caught in v0.4.0

## v0.4.0 2020 June 20

-   Add or remove the `package.json` keywords `deno`, `denoland`, `deno-entry`, and `deno-edition` based on successful deno compatibility
-   Cleaner and more detailed and useful output
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v0.3.0 2020 June 11

-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v0.2.2 2020 June 10

-   Fixed package imports that have a `deno` entry

## v0.2.1 2020 June 10

-   Now supports nested files
-   Now supports circular imports

## v0.2.0 2020 June 10

-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v0.1.2 2020 June 10

-   Use `https://` instead of `//`, as `//` fails with `error: File URL contains invalid path`

## v0.1.1 2020 June 10

-   Fixed `deno-edition` being generated instead of `edition-deno`

## v0.1.0 2020 June 10

-   Initial working release

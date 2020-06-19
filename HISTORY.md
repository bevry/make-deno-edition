# History

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

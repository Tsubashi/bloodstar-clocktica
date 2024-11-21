# Setup

## Getting started

Once you have cloned the repository, you can get set up to work in it by:

1. install npm
2. on the command line in project directory: `npm install`
3. You can then
    - Build: `npm run-script builddev` or `npm run-script buildprod`
    - Run the automatic building and development server: `npm run-script watch`
    - Serve files locally: `npm run-script serve`
    - In VS Code, tasks are set up for the above. Just press Ctrl+Shift+B (at least with the Visual Studio Keymap extension. It might be something else by default) and select which thing you'd like.
4. VS Code extensions I'm using
    - [markdownlint](https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint)
    - [Todo Tree](https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.todo-tree)
    - [Visual Studio Keymap](https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.todo-tree)
5. For debugging I just press F12 in Firefox or Chrome. Firefox is expecially nice for live-editting css because it has that 'changes' tab to keep track of what you did. Chrome seems to do a little better at showing source-mapped callstacks.

## How project was initialized

Initial setup was done like this. **(DO NOT do this with an already set-up project)**

1. install npm
2. on the command line in project directory:

    1. create the project
        > `npm init -y`
    2. typescript and webpack stuff
        > `npm install --save-dev typescript eslint  @typescript-eslint/parser @typescript-eslint/eslint-plugin webpack webpack-cli ts-loader style-loader css-loader live-server npm-run-all mini-css-extract-plugin css-minimizer-webpack-plugin html-webpack-plugin file-loader`
    3. because I'm using jszip:
        > `npm install --save-dev jszip`

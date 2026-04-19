# Bloodstar Clocktica

A Web utility for creating custom scripts and almanacs for the game _Blood on the Clocktower_.

## Developing

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
    - [Visual Studio Keymap](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vs-keybindings)
5. For debugging I just press F12 in Firefox or Chrome. Firefox is expecially nice for live-editting css because it has that 'changes' tab to keep track of what you did. Chrome seems to do a little better at showing source-mapped callstacks.

## Deploy to a new server

For production deployments we recommend docker compose.
using the published image and
run out-of-tree — you do not need to clone this repository onto the server.
You do need a copy of a few files from the repo (the compose file, `.env.sample`,
the `persistent/config/` and `persistent/published/` contents, and `schema.sql`),
so grab those however you like (clone elsewhere, download, `scp`, etc.).

1. **Pick a deployment directory** on the server, for example `/srv/bloodstar`.
   All remaining steps happen inside that directory.

2. **Copy the compose file and env file from the repo:**

    ```bash
    cp /path/to/repo/docker-compose.example.yaml docker-compose.yaml
    cp /path/to/repo/.env.sample .env
    ```

    Edit `.env` and fill in real values for `MYSQL_ROOT_PASSWORD`, `MYSQL_USER`,
    `MYSQL_USER_PASSWORD`, the `EMAIL_*` SMTP settings, and `WEB_PORT`. Edit
    `docker-compose.yaml` if you need to change the image tag, published ports,
    or mount paths for your environment.

3. **Create the `persistent/` directory tree** next to the compose file. The
    compose file bind-mounts each of these paths, so every one must exist
    before `docker compose up`:

    - `persistent/config/nginx.conf` — copy from the repo.
    - `persistent/config/php.ini` — copy from the repo.
    - `persistent/protected/` — create this directory and populate it with the
       secrets described in [`persistent/protected/README.md`](persistent/protected/README.md):
        - `db` — a JSON file with `host`, `username`, `password`, and `db` keys.
           Use `host: "db"`, `db: "bloodstar_db"`, `username: "bloodstar_user"`,
           and set `password` to match `MYSQL_USER_PASSWORD` in `.env`.
        - `jwt_key.pem` and `jwt_key.pub` — generate with:

            ```bash
            openssl genrsa -out persistent/protected/jwt_key.pem 2048
            openssl rsa -in persistent/protected/jwt_key.pem -pubout -out persistent/protected/jwt_key.pub
            ```

    - `persistent/usersave/` — create empty; user saves land here.
    - `persistent/published/` — create the directory and copy the default
       `almanac.css` and `print.css` from `persistent/published/` in the repo.
       Published almanacs will be written here at runtime.
    - `persistent/db_data/` — create empty; MariaDB stores its data files here.

4. **Start the stack:**

    ```bash
    docker compose up -d
    ```

    This pulls `tsubashi/bloodstar:latest` and `mariadb:latest` and starts both
    services.

5. **Initialize the database** on first boot by loading `schema.sql` into
    `bloodstar_db`:

    ```bash
    docker compose exec -T db mysql -u root -p"$MYSQL_ROOT_PASSWORD" bloodstar_db < schema.sql
    ```

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

# Declare default permissions as read only.
permissions: read-all

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  linux-main-checks:
    # https://github.com/actions/virtual-environments#available-environments
    runs-on: ubuntu-latest
    strategy:
      matrix:
        # Include all major maintenance + active LTS + current Node.js versions.
        # https://github.com/nodejs/Release#release-schedule
        node: [14, 16]
    steps:
      - name: Checkout
        uses: actions/checkout@v3
        with:
          fetch-depth: 2

      - name: Set up Node.js
        uses: actions/setup-node@v3.1.1
        with:
          node-version: ${{ matrix.node }}

      - name: Install dependencies
        run: |
          sudo apt-get install xvfb
          # Ensure both a Chromium and a Firefox binary are available.
          PUPPETEER_PRODUCT=firefox npm install
          npm install
          ls .local-chromium .local-firefox
      - name: Build
        run: |
          npm run build
      - name: Run code checks
        run: |
          npm run ensure-pinned-deps
          npm run lint
          # Skipping as it's flakey and we are not currently using the new documentation site in the wild yet.
          # See https://github.com/puppeteer/puppeteer/issues/7710 for more info
          # npm run generate-docs
          npm run ensure-correct-devtools-protocol-revision
          npm run test-types-file
      - name: Run commit lint
        run: |
          npm run commitlint
        if: github.event_name != 'pull_request'

      - name: Run unit tests
        uses: nick-invision/retry@v2
        env:
          CHROMIUM: true
        with:
          max_attempts: 3
          command: xvfb-run --auto-servernum npm run unit
          timeout_minutes: 10

      - name: Run unit tests with coverage
        env:
          CHROMIUM: true
        run: |
          xvfb-run --auto-servernum npm run unit-with-coverage
          xvfb-run --auto-servernum npm run assert-unit-coverage
      - name: Run unit tests on Firefox
        uses: nick-invision/retry@v2
        env:
          FIREFOX: true
          MOZ_WEBRENDER: 0
        with:
          max_attempts: 3
          timeout_minutes: 10
          command: xvfb-run --auto-servernum npm run funit

      - name: Run browser tests
        run: |
          npm run test-browser
      - name: Test bundling and installation
        env:
          CHROMIUM: true
        run: |
          # Note: this modifies package.json to test puppeteer-core.
          npm run test-install
          # Undo those changes.
          git checkout --force
  macos:
    # https://github.com/actions/virtual-environments#available-environments
    runs-on: macos-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3
        with:
          fetch-depth: 2

      - name: Set up Node.js
        uses: actions/setup-node@v3.1.1
        with:
          # Test only the oldest maintenance LTS Node.js version.
          # https://github.com/nodejs/Release#release-schedule
          node-version: 14

      - name: Install dependencies
        run: |
          # Test platform-specific browser binary fetching for both
          # Chromium and Firefox.
          PUPPETEER_PRODUCT=firefox npm install
          npm install
          ls .local-chromium .local-firefox
      - name: Build
        run: |
          npm run build
      - name: Run unit tests
        env:
          CHROMIUM: true
        run: |
          npm run unit
      - name: Run unit tests on Firefox
        uses: nick-invision/retry@v2
        with:
          max_attempts: 3
          timeout_minutes: 10
          command: npm run funit

  windows:
    # https://github.com/actions/virtual-environments#available-environments
    runs-on: windows-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3
        with:
          fetch-depth: 2

      - name: Set up Node.js
        uses: actions/setup-node@v3.1.1
        with:
          # Test only the oldest maintenance LTS Node.js version.
          # https://github.com/nodejs/Release#release-schedule
          node-version: 14

      - name: Install dependencies
        run: |
          # Test platform-specific browser binary fetching for both
          # Chromium and Firefox.
          $env:PUPPETEER_PRODUCT='firefox'
          npm install
          Remove-Item Env:\PUPPETEER_PRODUCT
          npm install
          Get-ChildItem -Path .local-chromium,.local-firefox
      - name: Build
        run: |
          npm run build
      - name: Run unit tests
        env:
          CHROMIUM: true
        run: |
          npm run unit
      - name: Run unit tests on Firefox
        uses: nick-invision/retry@v2
        continue-on-error: true
        env:
          FIREFOX: true
          MOZ_WEBRENDER: 0
        with:
          max_attempts: 3
          timeout_minutes: 10
          command: npm run funit

  linux-headful-checks:
    # https://github.com/actions/virtual-environments#available-environments
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [16]
    steps:
      - name: Checkout
        uses: actions/checkout@v3
        with:
          fetch-depth: 2

      - name: Set up Node.js
        uses: actions/setup-node@v3.1.1
        with:
          node-version: ${{ matrix.node }}
      - name: Install dependencies
        run: |
          sudo apt-get install xvfb
          # Ensure both a Chromium and a Firefox binary are available.
          PUPPETEER_PRODUCT=firefox npm install
          npm install
          ls .local-chromium .local-firefox
      - name: Build
        run: |
          npm run build
      - name: Run unit tests in headful mode
        uses: nick-invision/retry@v2
        continue-on-error: true
        env:
          CHROMIUM: true
          HEADLESS: false
        with:
          max_attempts: 1
          command: xvfb-run --auto-servernum npm run unit
          timeout_minutes: 10

  chrome-headless-checks:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        # https://github.com/actions/virtual-environments#available-environments
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [16]
    steps:
      - name: Checkout
        uses: actions/checkout@v3
        with:
          fetch-depth: 2
      - name: Set up Node.js
        uses: actions/setup-node@v3.1.1
        with:
          node-version: ${{ matrix.node }}
      - name: Install dependencies
        run: |
          npm install
          ls .local-chromium
      - name: Build
        run: |
          npm run build
      - name: Run unit tests
        uses: nick-invision/retry@v2
        continue-on-error: true
        env:
          CHROMIUM: true
        with:
          max_attempts: 1
          command: npm run chrome-headless-unit
          timeout_minutes: 30

.DEFAULT_GOAL := help

.PHONY: help install dev dev-lan test build check preview apk clean

define help_text
make install   Install project dependencies
make dev       Start the local development server
make dev-lan   Start the development server for testing on your network
make test      Run the automated tests
make build     Generate the production build in dist
make check     Run tests and build
make preview   Build and serve the production version locally
make apk       Build an installable Android debug APK
make clean     Remove the generated dist directory
endef

help:
	$(info $(help_text))

install:
	npm install

dev:
	npm run dev

dev-lan:
	npm run dev -- --host 0.0.0.0

test:
	npm test

build:
	npm run build

check: test build

preview: build
	npm run preview

apk: build
	node scripts/build-apk.mjs

clean:
	node -e "require('node:fs').rmSync('dist', { recursive: true, force: true })"

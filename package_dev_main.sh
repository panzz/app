#!/bin/bash
rm -f nodejs.tar.gz
tar -czvf nodejs.tar.gz --exclude '*.sh' --exclude '*.vrm*' --exclude '*.tar*' --exclude deadcode --exclude node_modules --exclude 'development*.json'  --exclude 'production*.json' --exclude .git *

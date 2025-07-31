#!/bin/bash

mkdir -p .temp

FILENAME="random_$(date +%s).txt"

dd if=/dev/urandom of=".temp/$FILENAME" bs=1024 count=20000
#!/bin/bash
export GIT_SEQUENCE_EDITOR="sed -i 's/^pick \(.*Update desktop agent tools and components\)/edit \1/'"
git rebase -i dd0f25d

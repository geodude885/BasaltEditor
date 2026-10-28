#!/bin/bash
# Publishes one copy of the website on the gh-pages branch, leaving the others as they are:
#
#   publish-pages.sh live <built>         the live site, at the root (a release)
#   publish-pages.sh prerelease <built>   /prerelease/ (main)
#   publish-pages.sh pr-12 <built>        /pr-12/ (a pull request's preview)
#   publish-pages.sh pr-12                takes that preview down
#
# gh-pages is always one commit, so old builds don't pile up in the repository. Runs can finish
# together (a preview and the prerelease, say), so each push only lands if gh-pages is still what that
# run started from; otherwise it starts again from the new one. Needs TOKEN and REPO in the environment.
set -euo pipefail

where=$1
built=${2:+$(realpath "$2")}
[[ $where =~ ^(live|prerelease|pr-[0-9]+)$ ]] || { echo "publish-pages.sh: not a copy of the site: $where" >&2; exit 2; }

url=${PAGES_REMOTE:-"https://github.com/${REPO}.git"}  # PAGES_REMOTE: another repository, to try it out
auth="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$TOKEN" | base64 -w0)"
git_() { git -c http.extraheader="$auth" -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" "$@"; }

for attempt in 1 2 3 4 5; do
  work=$(mktemp -d)
  # What gh-pages is now (nothing, the first time).
  was=$(git_ ls-remote "$url" refs/heads/gh-pages | cut -f1)
  if [ -n "$was" ]; then
    git_ init -q "$work/old" && git_ -C "$work/old" fetch -q --depth 1 "$url" "$was"
    git_ -C "$work/old" archive "$was" | (mkdir "$work/site" && tar -x -C "$work/site")
  else
    mkdir "$work/site"
  fi

  cd "$work/site"
  if [ "$where" = live ]; then
    # Everything but the test copies.
    find . -mindepth 1 -maxdepth 1 ! -name prerelease ! -name 'pr-*' -exec rm -rf {} +
    [ -n "$built" ] && cp -a "$built"/. .
  else
    rm -rf "$where"
    [ -n "$built" ] && cp -a "$built" "$where"
  fi
  touch .nojekyll

  git_ init -q -b gh-pages && git_ add -A
  message="${built:+Web build of ${BUILT_FROM:0:7} at /${where/live/}}"
  git_ commit -q --allow-empty -m "${message:-Took down /$where}"
  if git_ push -q --force-with-lease="gh-pages:$was" "$url" gh-pages; then
    echo "Published: ${message:-took down /$where}"
    exit 0
  fi
  echo "gh-pages moved while publishing; trying again ($attempt)" >&2
  cd / && rm -rf "$work"
  sleep $((attempt * 3))
done
echo "publish-pages.sh: gave up after 5 tries" >&2
exit 1

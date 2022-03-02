set -e

# set up
rm -rf custom-out-dir

# act
pnpm run build
pnpm exec cross-env HELLO=import-meta-env import-meta-env -o custom-out-dir/assets/import-meta-env*

# assert
diff -r custom-out-dir __fixtures__

#!/bin/sh

set -eu

# Older Expo SDK binaries do not ship separate dSYM bundles. During a device
# Release build, generate matching bundles from the exact frameworks embedded
# in the app so App Store Connect can match their UUIDs.
if [ "${PLATFORM_NAME:-}" != "iphoneos" ] || [ "${CONFIGURATION:-}" != "Release" ]; then
  exit 0
fi

frameworks_dir="${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}"
dsym_dir="${DWARF_DSYM_FOLDER_PATH}"

mkdir -p "${dsym_dir}"

for framework_name in crsqlite hermes; do
  binary_path="${frameworks_dir}/${framework_name}.framework/${framework_name}"
  output_path="${dsym_dir}/${framework_name}.framework.dSYM"

  if [ -f "${binary_path}" ]; then
    xcrun dsymutil "${binary_path}" -o "${output_path}"
  else
    echo "warning: ${framework_name}.framework was not found at ${binary_path}"
  fi
done

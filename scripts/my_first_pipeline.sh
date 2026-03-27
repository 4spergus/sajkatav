#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Function to display usage instructions
usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  --help, -h    Show this help message and exit

Description:
  This script performs the pipeline's main function. Add specific details about the pipeline here.
EOF
}

# Main function to handle arguments and execute the pipeline logic
main() {
  # Parse arguments
  if [[ $# -gt 0 ]]; then
    case "$1" in
      --help|-h)
        usage
        exit 0
        ;;
      *)
        echo "Error: Invalid argument '$1'" >&2
        usage
        exit 1
        ;;
    esac
  fi

  # Add the main pipeline logic here
  echo "Running the pipeline..."  
  echo "Hello world..."
}

# Call the main function with all arguments except the script name
main "$@"

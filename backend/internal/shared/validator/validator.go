// Package validator holds minimal, dependency-free input validation helpers.
package validator

import (
	"fmt"
	"strings"
)

// NonEmpty returns an error when value is empty after trimming surrounding
// whitespace. field names the offending input for the message.
func NonEmpty(field, value string) error {
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("%s is required", field)
	}
	return nil
}

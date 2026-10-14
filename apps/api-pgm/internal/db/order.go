package db

// NaturalName returns ORDER BY keys so "SMAN 2" comes before "SMAN 10".
func NaturalName(col string) string {
	return "lower(regexp_replace(" + col + ", '[0-9]+', '', 'g')), COALESCE((regexp_match(" + col + ", '[0-9]+'))[1]::numeric, 0), lower(" + col + ")"
}

WITH seed_events AS (
	DELETE FROM "application_status_events"
	WHERE "from_status" IS NULL
	RETURNING "user_id", "application_id", "to_status", "created_at"
),
inferred_steps AS (
	SELECT
		seed_events."user_id",
		seed_events."application_id",
		steps."from_status"::"application_status" AS "from_status",
		steps."to_status"::"application_status" AS "to_status",
		seed_events."created_at" + (steps."step" * INTERVAL '1 millisecond') AS "created_at"
	FROM seed_events
	CROSS JOIN LATERAL (
		VALUES
			(1, 'saved', 'applied', ARRAY['applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn', 'ghosted']),
			(2, 'applied', 'screening', ARRAY['screening', 'interview', 'offer']),
			(3, 'screening', 'interview', ARRAY['interview', 'offer']),
			(4, 'interview', 'offer', ARRAY['offer']),
			(2, 'applied', 'rejected', ARRAY['rejected']),
			(2, 'applied', 'withdrawn', ARRAY['withdrawn']),
			(2, 'applied', 'ghosted', ARRAY['ghosted'])
	) AS steps("step", "from_status", "to_status", "seed_statuses")
	WHERE seed_events."to_status"::text = ANY(steps."seed_statuses")
)
INSERT INTO "application_status_events" ("user_id", "application_id", "from_status", "to_status", "created_at")
SELECT "user_id", "application_id", "from_status", "to_status", "created_at"
FROM inferred_steps
ORDER BY "application_id", "created_at";

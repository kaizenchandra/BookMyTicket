CREATE FUNCTION venues.protect_space_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(OLD.venue_id,OLD.physical_capacity,OLD.turnaround_minutes) IS DISTINCT FROM ROW(NEW.venue_id,NEW.physical_capacity,NEW.turnaround_minutes) THEN
  RAISE EXCEPTION 'Physical space changes require a controlled remediation workflow';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_space_identity BEFORE UPDATE ON venues.spaces FOR EACH ROW EXECUTE FUNCTION venues.protect_space_identity();
CREATE FUNCTION inventory.protect_plan_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(OLD.space_id,OLD.plan_id,OLD.venue_snapshot,OLD.turnaround_minutes) IS DISTINCT FROM ROW(NEW.space_id,NEW.plan_id,NEW.venue_snapshot,NEW.turnaround_minutes) THEN
  RAISE EXCEPTION 'Occurrence seating plan snapshots cannot be silently replaced';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_plan_snapshot BEFORE UPDATE ON inventory.occurrences FOR EACH ROW EXECUTE FUNCTION inventory.protect_plan_snapshot();

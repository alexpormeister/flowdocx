CREATE TABLE public.pd_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id), name text NOT NULL CHECK (length(trim(name)) > 0), created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pd_roles TO authenticated;
GRANT ALL ON public.pd_roles TO service_role;
ALTER TABLE public.pd_roles ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX pd_roles_unique_name ON public.pd_roles (organization_id, lower(trim(name)));
CREATE POLICY pd_roles_read ON public.pd_roles FOR SELECT TO authenticated USING (public.has_org_role(auth.uid(), organization_id, 'viewer'));
CREATE POLICY pd_roles_write ON public.pd_roles FOR ALL TO authenticated USING (public.has_org_role(auth.uid(), organization_id, 'editor')) WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'editor'));
CREATE TABLE public.pd_systems (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id), name text NOT NULL CHECK (length(trim(name)) > 0), created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pd_systems TO authenticated;
GRANT ALL ON public.pd_systems TO service_role;
ALTER TABLE public.pd_systems ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX pd_systems_unique_name ON public.pd_systems (organization_id, lower(trim(name)));
CREATE POLICY pd_systems_read ON public.pd_systems FOR SELECT TO authenticated USING (public.has_org_role(auth.uid(), organization_id, 'viewer'));
CREATE POLICY pd_systems_write ON public.pd_systems FOR ALL TO authenticated USING (public.has_org_role(auth.uid(), organization_id, 'editor')) WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'editor'));
CREATE TABLE public.pd_processes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id), folder_id uuid NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE, name text NOT NULL CHECK (length(trim(name)) > 0), description text NOT NULL DEFAULT '', owner_user_id uuid, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','review','archived')), version integer NOT NULL DEFAULT 1 CHECK (version > 0), bpmn_model_id uuid REFERENCES public.projects(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pd_processes TO authenticated;
GRANT ALL ON public.pd_processes TO service_role;
ALTER TABLE public.pd_processes ENABLE ROW LEVEL SECURITY;
CREATE INDEX pd_processes_folder_idx ON public.pd_processes(folder_id);
CREATE POLICY pd_processes_read ON public.pd_processes FOR SELECT TO authenticated USING (public.has_org_role(auth.uid(), organization_id, 'viewer') AND public.can_view_org_folder(auth.uid(), folder_id));
CREATE POLICY pd_processes_insert ON public.pd_processes FOR INSERT TO authenticated WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'editor') AND public.can_view_org_folder(auth.uid(), folder_id));
CREATE POLICY pd_processes_update ON public.pd_processes FOR UPDATE TO authenticated USING (public.has_org_role(auth.uid(), organization_id, 'editor') AND public.can_view_org_folder(auth.uid(), folder_id)) WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'editor') AND public.can_view_org_folder(auth.uid(), folder_id));
CREATE POLICY pd_processes_delete ON public.pd_processes FOR DELETE TO authenticated USING (public.has_org_role(auth.uid(), organization_id, 'editor') AND public.can_view_org_folder(auth.uid(), folder_id));
CREATE TABLE public.pd_process_steps (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), process_id uuid NOT NULL REFERENCES public.pd_processes(id) ON DELETE CASCADE, sort_order integer NOT NULL DEFAULT 0, step_code text NOT NULL DEFAULT '', task text NOT NULL DEFAULT '', performer_role_id uuid REFERENCES public.pd_roles(id), system_id uuid REFERENCES public.pd_systems(id), output text NOT NULL DEFAULT '', is_decision boolean NOT NULL DEFAULT false, next_step_codes text[] NOT NULL DEFAULT '{}', notes text NOT NULL DEFAULT ''
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pd_process_steps TO authenticated;
GRANT ALL ON public.pd_process_steps TO service_role;
ALTER TABLE public.pd_process_steps ENABLE ROW LEVEL SECURITY;
CREATE INDEX pd_process_steps_process_idx ON public.pd_process_steps(process_id);
CREATE POLICY pd_steps_read ON public.pd_process_steps FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.pd_processes p WHERE p.id = process_id));
CREATE POLICY pd_steps_write ON public.pd_process_steps FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.pd_processes p WHERE p.id = process_id AND public.has_org_role(auth.uid(), p.organization_id, 'editor'))) WITH CHECK (EXISTS (SELECT 1 FROM public.pd_processes p WHERE p.id = process_id AND public.has_org_role(auth.uid(), p.organization_id, 'editor')));
CREATE TABLE public.pd_acknowledgements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), process_id uuid NOT NULL REFERENCES public.pd_processes(id) ON DELETE CASCADE, user_id uuid NOT NULL DEFAULT auth.uid(), acknowledged_at timestamptz NOT NULL DEFAULT now(), has_changes boolean NOT NULL DEFAULT false, comment text NOT NULL DEFAULT ''
);
GRANT SELECT, INSERT ON public.pd_acknowledgements TO authenticated;
GRANT ALL ON public.pd_acknowledgements TO service_role;
ALTER TABLE public.pd_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE INDEX pd_acknowledgements_process_idx ON public.pd_acknowledgements(process_id, acknowledged_at DESC);
CREATE POLICY pd_ack_read ON public.pd_acknowledgements FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.pd_processes p WHERE p.id = process_id));
CREATE POLICY pd_ack_insert ON public.pd_acknowledgements FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.pd_processes p WHERE p.id = process_id));
CREATE FUNCTION public.validate_pd_process() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.folders f WHERE f.id = NEW.folder_id AND f.organization_id = NEW.organization_id) THEN RAISE EXCEPTION 'Folder does not belong to organization'; END IF;
 IF NEW.owner_user_id IS NOT NULL AND NOT public.has_org_role(NEW.owner_user_id, NEW.organization_id, 'viewer') THEN RAISE EXCEPTION 'Owner must be an accepted organization member'; END IF;
 IF NEW.bpmn_model_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = NEW.bpmn_model_id AND p.organization_id = NEW.organization_id) THEN RAISE EXCEPTION 'BPMN model does not belong to organization'; END IF;
 NEW.updated_at := now();
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_pd_process_before_write BEFORE INSERT OR UPDATE ON public.pd_processes FOR EACH ROW EXECUTE FUNCTION public.validate_pd_process();
CREATE FUNCTION public.validate_pd_step() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE org_id uuid;
BEGIN
 SELECT organization_id INTO org_id FROM public.pd_processes WHERE id = NEW.process_id;
 IF org_id IS NULL THEN RAISE EXCEPTION 'Process not accessible'; END IF;
 IF NEW.performer_role_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.pd_roles WHERE id = NEW.performer_role_id AND organization_id = org_id) THEN RAISE EXCEPTION 'Role does not belong to organization'; END IF;
 IF NEW.system_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.pd_systems WHERE id = NEW.system_id AND organization_id = org_id) THEN RAISE EXCEPTION 'System does not belong to organization'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_pd_step_before_write BEFORE INSERT OR UPDATE ON public.pd_process_steps FOR EACH ROW EXECUTE FUNCTION public.validate_pd_step();
CREATE FUNCTION public.save_pd_process(_process jsonb, _steps jsonb, _expected_version integer DEFAULT NULL) RETURNS public.pd_processes LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE result public.pd_processes; pid uuid := (_process->>'id')::uuid;
BEGIN
 IF jsonb_typeof(_steps) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Steps must be an array'; END IF;
 IF _expected_version IS NULL THEN
 INSERT INTO public.pd_processes(id,organization_id,folder_id,name,description,owner_user_id,status) VALUES (pid,(_process->>'organization_id')::uuid,(_process->>'folder_id')::uuid,trim(_process->>'name'),coalesce(_process->>'description',''),nullif(_process->>'owner_user_id','')::uuid,coalesce(_process->>'status','draft')) RETURNING * INTO result;
 ELSE
 UPDATE public.pd_processes SET name=trim(_process->>'name'),description=coalesce(_process->>'description',''),owner_user_id=nullif(_process->>'owner_user_id','')::uuid,status=_process->>'status',version=version+1 WHERE id=pid AND version=_expected_version RETURNING * INTO result;
 IF result.id IS NULL THEN RAISE EXCEPTION 'Process changed or edit access denied. Reload before saving.'; END IF;
 END IF;
 DELETE FROM public.pd_process_steps WHERE process_id = pid;
 INSERT INTO public.pd_process_steps(id,process_id,sort_order,step_code,task,performer_role_id,system_id,output,is_decision,next_step_codes,notes)
 SELECT coalesce(nullif(s->>'id','')::uuid,gen_random_uuid()),pid,(n-1)::integer,coalesce(s->>'step_code',''),coalesce(s->>'task',''),nullif(s->>'performer_role_id','')::uuid,nullif(s->>'system_id','')::uuid,coalesce(s->>'output',''),coalesce((s->>'is_decision')::boolean,false),ARRAY(SELECT jsonb_array_elements_text(coalesce(s->'next_step_codes','[]'::jsonb))),coalesce(s->>'notes','') FROM jsonb_array_elements(_steps) WITH ORDINALITY AS items(s,n);
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.validate_pd_process(), public.validate_pd_step(), public.save_pd_process(jsonb,jsonb,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_pd_process(jsonb,jsonb,integer) TO authenticated, service_role;
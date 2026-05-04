UPDATE public.projects
SET bpmn_xml = regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(bpmn_xml, '\s+bioc:fill="[^"]*"', '', 'g'),
      '\s+bioc:stroke="[^"]*"', '', 'g'
    ),
    '\s+color:background-color="[^"]*"', '', 'g'
  ),
  '\s+color:border-color="[^"]*"', '', 'g'
)
WHERE bpmn_xml ~ 'bioc:|color:background-color|color:border-color';
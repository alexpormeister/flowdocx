# Architecture rules

- PD derives its hierarchy from the existing folders and stores handbook processes separately from BPMN projects, so either representation can evolve without duplicating departments.
- PD saves a process and its ordered steps through a security-invoker transaction, so partial saves cannot corrupt the handbook and RLS remains authoritative.
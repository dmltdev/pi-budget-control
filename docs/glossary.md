# Glossary

## Budget control

A session guard that reads provider usage and blocks costly turns when the configured usage window reaches its cap.

## Cap

The percentage of a provider usage window at which budget control blocks new spend. Global defaults come from environment variables. A session cap applies only to the current session.

## Bypass

A user-requested exception that lets work continue despite the cap. `ignore once` applies to one prompt. Timed ignore applies until its deadline. `off` disables budget control until re-enabled.

## 5-hour window

The short provider usage window exposed by `omp usage`. This plugin enforces this window only.

## 7-day window

The long provider usage window exposed by `omp usage`. This plugin reports no policy against it and leaves it to external observability.

## Exec/write-class tool

A tool that can execute code, mutate files, drive browser automation, or spawn agents. These tools are blocked over cap.

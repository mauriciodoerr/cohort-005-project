# The Learner role is still stored as "student"

The domain language calls people who buy and take courses **Learners** (see `GLOSSARY.md`), and every name in the code and every piece of text people read says Learner. The role's stored value is still `"student"` (`UserRole.Learner = "student"`). We kept it so the rename needed no data migration on existing user rows and sessions. The cost is that the raw value must never be shown to anyone: UI shows the role through `USER_ROLE_LABELS`.

## Considered Options

- **Also rename the stored value to `"learner"`, with a migration.** Rejected for now: it touches every user row for no change in behaviour. It is still the right move if the raw value ever leaks out, for example into an API or an export.

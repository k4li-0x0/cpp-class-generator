# cpp-class-generator README

Explorer -> RMB on folder -> Generate files for C++ class

Found a bug? [Create issue on github](https://github.com/k4li-0x0/cpp-class-generator/issues/new)

Contributions are welcome

## Extension settings variables:

{userName} - cpp-class-generator.user.name or system username

{year} - current year

{date} - current date 

{copyright} - cpp-class-generator.project.copyright

{namespaceStart} - namespace start is `namespace NamespaceName {`

{namespaceEnd} - namespace end is `} // NamespaceName`

{namespaceTab} - automatic namespace content tabulation. If there is no namespace, no tab will be added

{namespaceScope} - inline namespace scope is `NamespaceName::`

{className} - specified class name

{headerFileName} - specified name with header extension

## Config example

```json
"cpp-class-generator.templates": [
    {
        "name": "Header-only class",
        "header": [
            "{copyright}",
            "",
            "#pragma once",
            "",
            "{namespaceStart}",
            "{namespaceTab}class {className} {",
            "{namespaceTab}};",
            "{namespaceEnd}"
        ]
    },
    {
        "name": "Separated source/header class",
        "header": "Header-only class", // Reference to header in other template
        "source": [
            "{copyright}",
            "",
            "#include \"{headerFileName}\"",
            ""
        ] 
    }
]
```

Configs from global and local settings will be merged - you can add main classes in global settings and project-specific classes in workspace settings, without duplicates.

## Current version - [v1.2.0] - 16.08.2024

### Added

 - {year} variable [Issue#17](https://github.com/k4li-0x0/cpp-class-generator/issues/17)

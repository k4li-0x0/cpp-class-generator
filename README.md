# cpp-class-generator README

Explorer -> RMB on folder -> Generate files for C++ class

## Extension settings variables:

<%userName%> - cpp-class-generator.user.name or system username

<%date%> - current date dd/mm/yyyy

<%copyright%> - cpp-class-generator.project.copyright

<%namespaceStart%> - namespace start is `namespace NamespaceName {`

<%namespaceEnd%> - namespace end is `} // NamespaceName`

<%namespaceTab%> - automatic namespace content tabulation. If there is no namespace tabulation, no tab will be added

<%className%> - specified class name

<%headerFileName%> - specified name with header extension

## Current version - [v0.1.0b]

### Added

- FileFactory class
- <%namespaceTab%> tag for namespace tabulation

### Changed

- cpp-class-generator.templates.copyright now contains the full comment
- cpp-class-generator.tmeplates.header: removed comments from the beginning
- cpp-class-generator.templates.single-header-extension: added .hh
- cpp-class-generator.templates.header-extension: added .hh
- cpp-class-generator.templates.source-extension: added .cc
- code structure completely changed

### Fixed 

- [Issue#1](https://github.com/k4li-0x0/cpp-class-generator/issues/1)
- [Issue#2](https://github.com/k4li-0x0/cpp-class-generator/issues/2)



/**
 * C++ class template
 */
export interface Template {
    /**
     * Header content or name of other template
     */
    header: string | Array<string>;

    /**
     * Source content or name of other template. When null class is single-header
     */
    source?: string | Array<string>;

    /**
     * Extension of header file. When null used .h for separated source/header classes and .hpp for single-header classes
     */
    header_extension?: string;

    /**
     * Extension of source file. When null used .cpp
     */
    source_extension?: string;
}

/**
 * C++ class template
 */
export interface ConfigTemplate extends Template {
    /**
     * Name of class template
     */
    name: string;
}
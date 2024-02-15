class ApiError extends Error{
    constructor(
        statusCode,
        message="Something went wrong",
         errors=[],
        ){
       this.statusCode=statusCode
       super(message)
       this.success=false
       this.errors=errors
    }
}
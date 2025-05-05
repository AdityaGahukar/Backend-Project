class ApiError extends Error {
  constructor(
    statusCode,
    message = "Something went wrong",
    errors = [],
    statck = ""  // stack trace of the error
  ) { 
    // overriding the default Error constructor
    super(message);
    this.statusCode = statusCode;
    this.data = null; // data to be sent in the response
    this.message = message;
    this.success = false; // success status of the response
    this.errors = errors;
    
    if(statck) {
        this.stack = statck; // stack trace of the error
    } else{
        Error.captureStackTrace(this, this.constructor); // capture the stack trace of the error
    }
  }
}

export {ApiError}

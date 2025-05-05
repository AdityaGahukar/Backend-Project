class ApiResponse {
    constructor(statusCode, data, message = "Success") {
        this.statusCode = statusCode; // HTTP status code
        this.data = data; // data to be sent in the response
        this.message = message; // message to be sent in the response
        this.success = statusCode < 400; // success status of the response
    }
}

export { ApiResponse };
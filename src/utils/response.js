function success(data) {
  return { success: true, data };
}

function error(message, statusCode = 400) {
  return { success: false, error: message, statusCode };
}

module.exports = { success, error };

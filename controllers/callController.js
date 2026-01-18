import Call from "../models/callModel.js";

/**
 * Create a new call
 * POST /api/calls
 */
const createCall = async (req, res, next) => {
  try {
    const { caller, receiver, callType, startedAt, endedAt, duration } = req.body;

    const call = await Call.create({
      caller,
      receiver,
      callType,
      startedAt,
      endedAt,
      duration,
    });

    res.status(201).json({
      success: true,
      data: call,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get call by ID
 * GET /api/calls/:id
 */
const getCallById = async (req, res, next) => {
  try {
    const call = await Call.findById(req.params.id)
      .populate("caller", "name email")
      .populate("receiver", "name email");

    if (!call) return res.status(404).json({ success: false, message: "Call not found" });

    res.status(200).json({ success: true, data: call });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all calls
 * GET /api/calls
 * Supports filtering by caller, receiver, status, callType, pagination
 */
const getAllCalls = async (req, res, next) => {
  try {
    const { caller, receiver, status, callType, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (caller) filter.caller = caller;
    if (receiver) filter.receiver = receiver;
    if (status) filter.status = status;
    if (callType) filter.callType = callType;

    const total = await Call.countDocuments(filter);
    const calls = await Call.find(filter)
      .populate("caller", "name email")
      .populate("receiver", "name email")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      total,
      count: calls.length,
      data: calls,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update call (PUT) - full update
 * PUT /api/calls/:id
 */
const updateCall = async (req, res, next) => {
  try {
    const call = await Call.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!call) return res.status(404).json({ success: false, message: "Call not found" });

    res.status(200).json({ success: true, data: call });
  } catch (error) {
    next(error);
  }
};

/**
 * Patch call (PATCH) - partial update
 * PATCH /api/calls/:id
 */
const patchCall = async (req, res, next) => {
  try {
    const call = await Call.findById(req.params.id);
    if (!call) return res.status(404).json({ success: false, message: "Call not found" });

    Object.keys(req.body).forEach(key => {
      call[key] = req.body[key];
    });

    await call.save();
    res.status(200).json({ success: true, data: call });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete call
 * DELETE /api/calls/:id
 */
const deleteCall = async (req, res, next) => {
  try {
    const call = await Call.findByIdAndDelete(req.params.id);
    if (!call) return res.status(404).json({ success: false, message: "Call not found" });

    res.status(200).json({ success: true, message: "Call deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * Update call status
 * PATCH /api/calls/:id/status
 */
const updateCallStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const call = await Call.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!call) return res.status(404).json({ success: false, message: "Call not found" });

    res.status(200).json({ success: true, data: call });
  } catch (error) {
    next(error);
  }
};

/**
 * Update call duration
 * PATCH /api/calls/:id/duration
 */
const updateCallDuration = async (req, res, next) => {
  try {
    const { duration, endedAt } = req.body;
    const call = await Call.findByIdAndUpdate(
      req.params.id,
      { duration, endedAt },
      { new: true, runValidators: true }
    );

    if (!call) return res.status(404).json({ success: false, message: "Call not found" });

    res.status(200).json({ success: true, data: call });
  } catch (error) {
    next(error);
  }
};

export const callController = {
  createCall,
  getCallById,
  getAllCalls,
  updateCall,
  patchCall,
  deleteCall,
  updateCallStatus,
  updateCallDuration,
};

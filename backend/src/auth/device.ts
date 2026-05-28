import { randomBytes } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db, schema } from '../db/client.js';

const DEVICE_CODE_TTL_MIN = 15;

/**
 * Device-code flow (mirrors `gh auth login`).
 *
 *   1. Editor POSTs /auth/device → returns { device_code, user_code, verification_uri, expires_in, interval }
 *   2. Editor opens browser to verification_uri, user pastes user_code, signs in via GitHub OAuth.
 *   3. The /auth/github/callback handler approves the matching device_code if `state` carries it.
 *   4. Editor polls /auth/device/poll { device_code } until status === 'approved', then receives the session token.
 */
export async function createDeviceCode(): Promise<{
	device_code: string;
	user_code: string;
	expires_in: number;
	interval: number;
}> {
	const deviceCode = randomBytes(24).toString('hex');
	const userCode = generateUserCode();
	const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_MIN * 60 * 1000);

	await db.insert(schema.deviceCodes).values({
		deviceCode,
		userCode,
		status: 'pending',
		expiresAt
	});

	return {
		device_code: deviceCode,
		user_code: userCode,
		expires_in: DEVICE_CODE_TTL_MIN * 60,
		interval: 5
	};
}

export async function approveDeviceCode(userCode: string, userId: string): Promise<boolean> {
	const result = await db
		.update(schema.deviceCodes)
		.set({ status: 'approved', userId })
		.where(and(
			eq(schema.deviceCodes.userCode, userCode.toUpperCase()),
			eq(schema.deviceCodes.status, 'pending')
		))
		.returning({ id: schema.deviceCodes.id });
	return result.length > 0;
}

export async function pollDeviceCode(deviceCode: string): Promise<{
	status: 'pending' | 'approved' | 'denied' | 'expired';
	userId?: string;
}> {
	const rows = await db
		.select({
			status: schema.deviceCodes.status,
			userId: schema.deviceCodes.userId,
			expiresAt: schema.deviceCodes.expiresAt
		})
		.from(schema.deviceCodes)
		.where(eq(schema.deviceCodes.deviceCode, deviceCode))
		.limit(1);

	const row = rows[0];
	if (!row) return { status: 'expired' };
	if (row.expiresAt.getTime() <= Date.now()) return { status: 'expired' };

	if (row.status === 'approved' && row.userId) {
		// One-shot: consume the device code on first successful poll.
		await db.delete(schema.deviceCodes).where(eq(schema.deviceCodes.deviceCode, deviceCode));
		return { status: 'approved', userId: row.userId };
	}

	return { status: row.status };
}

/**
 * Generate an 8-char user code in the format XXXX-XXXX from an unambiguous alphabet.
 *
 * Excludes 0/O and 1/I/L to avoid user transcription errors.
 */
function generateUserCode(): string {
	const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
	const bytes = randomBytes(8);
	let code = '';
	for (let i = 0; i < 8; i++) {
		code += alphabet[bytes[i]! % alphabet.length];
		if (i === 3) code += '-';
	}
	return code;
}

import pool from './db.js';
import * as emailService from './emailService.js';

/**
 * Get all consumables
 */
export async function getAllConsumables() {
  try {
    const result = await pool.query(
      'SELECT * FROM consumables ORDER BY name ASC'
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching consumables:', error);
    throw error;
  }
}

/**
 * Get consumable by ID
 */
export async function getConsumableById(id) {
  try {
    const result = await pool.query(
      'SELECT * FROM consumables WHERE id = $1',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching consumable:', error);
    throw error;
  }
}

/**
 * Create new consumable
 */
export async function createConsumable(data) {
  const client = await pool.connect();
  try {
    const {
      name, category, description, quantity, min_quantity, unit,
      unit_cost, location, supplier, sku, notes, user_id
    } = data;

    await client.query('BEGIN');
    
    await client.query(
      "SELECT set_config('app.current_user_id', $1, FALSE)",
      [user_id.toString()]
    );

    const result = await client.query(
      `INSERT INTO consumables (
        name, category, description, quantity, min_quantity, unit,
        unit_cost, location, supplier, sku, notes, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [name, category, description, quantity || 0, min_quantity || 0, unit || 'pieces',
       unit_cost || 0, location, supplier, sku, notes, user_id]
    );

    await client.query('COMMIT');
    
    // Check if alert needed
    await checkAndCreateLowStockAlert(result.rows[0]);
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating consumable:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update consumable
 */
export async function updateConsumable(id, data) {
  try {
    const {
      name, category, description, min_quantity, unit,
      unit_cost, location, supplier, sku, notes
    } = data;

    const result = await pool.query(
      `UPDATE consumables SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        description = COALESCE($3, description),
        min_quantity = COALESCE($4, min_quantity),
        unit = COALESCE($5, unit),
        unit_cost = COALESCE($6, unit_cost),
        location = COALESCE($7, location),
        supplier = COALESCE($8, supplier),
        sku = COALESCE($9, sku),
        notes = COALESCE($10, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *`,
      [name, category, description, min_quantity, unit, unit_cost, location, supplier, sku, notes, id]
    );

    if (result.rows[0]) {
      await checkAndCreateLowStockAlert(result.rows[0]);
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error updating consumable:', error);
    throw error;
  }
}

/**
 * Delete consumable
 */
export async function deleteConsumable(id) {
  try {
    const result = await pool.query(
      'DELETE FROM consumables WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error deleting consumable:', error);
    throw error;
  }
}

/**
 * Adjust stock quantity
 */
export async function adjustStock(id, quantityChange, reason, performedBy, performedByName, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(
      "SELECT set_config('app.current_user_id', $1, FALSE)",
      [userId.toString()]
    );

    // Get current quantity
    const consumable = await client.query(
      'SELECT * FROM consumables WHERE id = $1',
      [id]
    );

    if (!consumable.rows[0]) {
      throw new Error('Consumable not found');
    }

    const quantityBefore = consumable.rows[0].quantity;
    const quantityAfter = quantityBefore + quantityChange;

    if (quantityAfter < 0) {
      throw new Error('Insufficient stock');
    }

    // Update quantity
    const updated = await client.query(
      `UPDATE consumables SET 
        quantity = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *`,
      [quantityAfter, id]
    );

    // Record transaction
    await client.query(
      `INSERT INTO consumable_transactions (
        consumable_id, transaction_type, quantity_change, quantity_before,
        quantity_after, reason, performed_by, performed_by_name, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        quantityChange > 0 ? 'add' : 'remove',
        quantityChange,
        quantityBefore,
        quantityAfter,
        reason,
        performedBy,
        performedByName,
        userId
      ]
    );

    await client.query('COMMIT');
    
    // Check if alert needed
    await checkAndCreateLowStockAlert(updated.rows[0]);
    
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adjusting stock:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get transaction history for a consumable
 */
export async function getConsumableTransactions(consumableId) {
  try {
    const result = await pool.query(
      `SELECT * FROM consumable_transactions 
       WHERE consumable_id = $1 
       ORDER BY created_at DESC`,
      [consumableId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}

/**
 * Get low stock items
 */
export async function getLowStockItems() {
  try {
    const result = await pool.query(
      'SELECT * FROM consumables WHERE quantity <= min_quantity ORDER BY quantity ASC'
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    throw error;
  }
}

/**
 * Check and create low stock alert
 */
async function checkAndCreateLowStockAlert(consumable) {
  try {
    if (consumable.quantity <= consumable.min_quantity) {
      // Create or update alert
      const severity = consumable.quantity === 0 ? 'critical' : 'warning';
      const message = consumable.quantity === 0 
        ? `OUT OF STOCK: ${consumable.name}`
        : `Low stock: ${consumable.name} (${consumable.quantity} ${consumable.unit} remaining)`;

      await pool.query(
        `INSERT INTO security_alerts (
          alert_type, severity, message, source, metadata, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING`,
        [
          'low_stock',
          severity,
          message,
          'inventory_system',
          JSON.stringify({
            consumable_id: consumable.id,
            consumable_name: consumable.name,
            quantity: consumable.quantity,
            min_quantity: consumable.min_quantity,
            unit: consumable.unit
          }),
          consumable.user_id
        ]
      );

      // Send email notification (non-blocking)
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail && adminEmail !== 'noreply@itasset.local') {
        const isOutOfStock = consumable.quantity === 0;
        emailService.sendLowStockAlertEmail(
          adminEmail,
          consumable.name,
          consumable.quantity,
          consumable.min_quantity,
          consumable.unit || 'units',
          isOutOfStock,
          {
            category: consumable.category,
            supplier: consumable.supplier,
            lastOrderDate: consumable.last_order_date,
            reorderQuantity: consumable.min_quantity * 2 // Suggest 2x minimum
          }
        ).catch(err => console.error('Failed to send low stock email:', err));
      }
    } else {
      // If stock is now sufficient, resolve any existing alerts
      await pool.query(
        `UPDATE security_alerts SET 
          status = 'resolved',
          resolved_at = CURRENT_TIMESTAMP
         WHERE alert_type = 'low_stock' 
         AND metadata->>'consumable_id' = $1
         AND status = 'active'`,
        [consumable.id.toString()]
      );
    }
  } catch (error) {
    console.error('Error managing low stock alert:', error);
  }
}

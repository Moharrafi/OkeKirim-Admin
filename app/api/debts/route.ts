import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { notifyNewDebt, notifyDebtPayment, notifyEditDebt } from "@/lib/notify-admin"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const driver = searchParams.get("driver")
    const status = searchParams.get("status")

    let query = "SELECT * FROM debts"
    const params: any[] = []
    const conditions: string[] = []

    if (driver) {
      conditions.push("driver = ?")
      params.push(driver)
    }
    if (status) {
      conditions.push("status = ?")
      params.push(status)
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ")
    }
    query += " ORDER BY id DESC"

    const [debts] = await pool.execute(query, params)

    let paymentQuery = "SELECT * FROM debt_payments"
    const paymentParams: any[] = []
    if (driver) {
      paymentQuery += " WHERE driver = ?"
      paymentParams.push(driver)
    }
    paymentQuery += " ORDER BY id DESC"
    const [payments] = await pool.execute(paymentQuery, paymentParams)

    return NextResponse.json({ debts, payments })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { driver, vehicle, amount, date, dueDate, notes, type } = body

    if (!driver || !amount) {
      return NextResponse.json({ error: "Nama driver dan nominal kasbon wajib diisi" }, { status: 400 })
    }

    const [result] = await pool.execute(
      "INSERT INTO debts (driver, vehicle, amount, date, dueDate, notes, type, status, paidAmount) VALUES (?, ?, ?, ?, ?, ?, ?, 'belum_lunas', 0)",
      [
        driver,
        vehicle || null,
        parseInt(String(amount)),
        date || new Date().toISOString().split("T")[0],
        dueDate || null,
        notes || null,
        type || "kasbon"
      ]
    ) as any

    // Trigger push notification to driver (non-blocking)
    notifyNewDebt(driver, parseInt(String(amount)), vehicle || undefined).catch(err => {
      console.error("FCM notifyNewDebt failed:", err)
    })

    return NextResponse.json({ success: true, id: result.insertId }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { debt_id, amount, notes, paid_at } = body

    if (!debt_id || !amount) {
      return NextResponse.json({ error: "debt_id dan nominal bayar wajib diisi" }, { status: 400 })
    }

    // Get current debt
    const [rows] = await pool.execute("SELECT * FROM debts WHERE id = ? LIMIT 1", [debt_id]) as any[]
    const debt = rows[0]
    if (!debt) {
      return NextResponse.json({ error: "Data kasbon tidak ditemukan" }, { status: 404 })
    }

    const paymentAmount = parseInt(String(amount))
    const newPaidAmount = Number(debt.paidAmount || 0) + paymentAmount
    const isLunas = newPaidAmount >= Number(debt.amount)
    const status = isLunas ? "lunas" : "belum_lunas"
    const paidOffAt = isLunas ? new Date() : null

    // Update debt
    await pool.execute(
      "UPDATE debts SET paidAmount = ?, status = ?, lastPaidAt = NOW(), paidOffAt = ? WHERE id = ?",
      [newPaidAmount, status, paidOffAt, debt_id]
    )

    // Insert payment log
    const [payResult] = await pool.execute(
      "INSERT INTO debt_payments (debt_id, driver, amount, notes, paid_at) VALUES (?, ?, ?, ?, ?)",
      [
        debt_id,
        debt.driver,
        paymentAmount,
        notes || null,
        paid_at || new Date().toISOString().slice(0, 19).replace('T', ' ')
      ]
    ) as any

    // Trigger push notification to driver (non-blocking)
    const remaining = Math.max(0, Number(debt.amount) - newPaidAmount)
    notifyDebtPayment(debt.driver, paymentAmount, remaining).catch(err => {
      console.error("FCM notifyDebtPayment failed:", err)
    })

    return NextResponse.json({ success: true, paymentId: payResult.insertId })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, type } = body

    if (!id) {
      return NextResponse.json({ error: "ID wajib diisi" }, { status: 400 })
    }

    if (type === "payment") {
      const [payments] = await pool.execute("SELECT * FROM debt_payments WHERE id = ? LIMIT 1", [id]) as any[]
      const payment = payments[0]
      if (payment) {
        const [debts] = await pool.execute("SELECT * FROM debts WHERE id = ? LIMIT 1", [payment.debt_id]) as any[]
        const debt = debts[0]
        if (debt) {
          const newPaidAmount = Math.max(0, Number(debt.paidAmount || 0) - Number(payment.amount))
          const isLunas = newPaidAmount >= Number(debt.amount)
          const status = isLunas ? "lunas" : "belum_lunas"
          const paidOffAt = isLunas ? debt.paidOffAt : null
          await pool.execute(
            "UPDATE debts SET paidAmount = ?, status = ?, paidOffAt = ? WHERE id = ?",
            [newPaidAmount, status, paidOffAt, payment.debt_id]
          )
        }
        await pool.execute("DELETE FROM debt_payments WHERE id = ?", [id])
      }
    } else {
      await pool.execute("DELETE FROM debts WHERE id = ?", [id])
      await pool.execute("DELETE FROM debt_payments WHERE debt_id = ?", [id])
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, driver, vehicle, amount, date, dueDate, notes } = body

    if (!id) {
      return NextResponse.json({ error: "ID kasbon wajib diisi" }, { status: 400 })
    }

    // 1. Get the current debt record to know paidAmount
    const [rows] = await pool.execute("SELECT * FROM debts WHERE id = ? LIMIT 1", [id]) as any[]
    const debt = rows[0]
    if (!debt) {
      return NextResponse.json({ error: "Data kasbon tidak ditemukan" }, { status: 404 })
    }

    const newAmount = amount !== undefined ? parseInt(String(amount)) : Number(debt.amount)
    const paidAmount = Number(debt.paidAmount || 0)
    const isLunas = paidAmount >= newAmount
    const status = isLunas ? "lunas" : "belum_lunas"
    const paidOffAt = isLunas ? (debt.paidOffAt || new Date()) : null

    // 2. Update the debt record
    await pool.execute(
      `UPDATE debts 
       SET driver = ?, vehicle = ?, amount = ?, date = ?, dueDate = ?, notes = ?, status = ?, paidOffAt = ?
       WHERE id = ?`,
      [
        driver !== undefined ? driver : debt.driver,
        vehicle !== undefined ? vehicle : debt.vehicle,
        newAmount,
        date !== undefined ? date : debt.date,
        dueDate !== undefined ? (dueDate || null) : debt.dueDate,
        notes !== undefined ? (notes || null) : debt.notes,
        status,
        paidOffAt,
        id
      ]
    )

    // Also update any driver name in debt_payments if the driver name changed
    if (driver !== undefined && driver !== debt.driver) {
      await pool.execute("UPDATE debt_payments SET driver = ? WHERE debt_id = ?", [driver, id])
    }

    // Trigger push notification to driver (non-blocking) if amount or vehicle changed
    if (driver || amount !== undefined || vehicle !== undefined) {
      const notifyName = driver || debt.driver
      notifyEditDebt(notifyName, newAmount, vehicle !== undefined ? vehicle : debt.vehicle).catch(err => {
        console.error("FCM notifyEditDebt failed:", err)
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
